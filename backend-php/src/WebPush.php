<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * Sends browser push messages (Web Push, RFC 8030) with no library, because
 * the host has no Composer: VAPID authentication (RFC 8292) and payload
 * encryption (aes128gcm, RFC 8188 / RFC 8291) on top of PHP's openssl.
 *
 * The server's VAPID key pair lives in push_vapid_keys, created on first use.
 * Keeping it in the database rather than in a file means a deploy can never
 * overwrite it (a new key would silently orphan every subscription).
 */
final class WebPush
{
    private const TTL_SECONDS = 86400;

    /** @return array{private_pem: string, public_key: string} public_key is the raw 65-byte point, base64url. */
    public static function vapidKeys(PDO $pdo): array
    {
        $select = $pdo->prepare('SELECT private_pem, public_key FROM push_vapid_keys WHERE id = 1');
        $select->execute();
        $row = $select->fetch();
        if ($row !== false) {
            return $row;
        }

        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if ($key === false) {
            throw new \RuntimeException('Could not generate a VAPID key: ' . openssl_error_string());
        }
        openssl_pkey_export($key, $pem);
        $public = self::publicPoint($key);

        // INSERT IGNORE: two first requests racing must end up with the same key.
        $pdo->prepare('INSERT IGNORE INTO push_vapid_keys (id, private_pem, public_key) VALUES (1, :pem, :pub)')
            ->execute(['pem' => $pem, 'pub' => self::b64url($public)]);

        $select->execute();
        return $select->fetch();
    }

    /**
     * Sends one message. Returns the push service's HTTP status: 201 means
     * accepted; 404 or 410 means the subscription is gone and should be deleted.
     *
     * @param array{endpoint: string, p256dh: string, auth: string} $subscription
     */
    public static function send(PDO $pdo, array $subscription, string $payload, string $subject): int
    {
        $vapid = self::vapidKeys($pdo);
        $body = self::encrypt($payload, self::b64urlDecode($subscription['p256dh']), self::b64urlDecode($subscription['auth']));

        $parts = parse_url($subscription['endpoint']);
        $audience = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '');
        $jwt = self::vapidJwt($vapid['private_pem'], $audience, $subject);

        $ch = curl_init($subscription['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/octet-stream',
                'Content-Encoding: aes128gcm',
                'Content-Length: ' . strlen($body),
                'TTL: ' . self::TTL_SECONDS,
                'Urgency: high',
                'Authorization: vapid t=' . $jwt . ', k=' . $vapid['public_key'],
            ],
        ]);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $status;
    }

    /**
     * RFC 8291 message encryption. $uaPublic is the browser's 65-byte P-256
     * point, $authSecret its 16-byte auth secret. $asKey and $salt exist only so
     * a test can pin the otherwise random values.
     */
    public static function encrypt(string $plaintext, string $uaPublic, string $authSecret, $asKey = null, ?string $salt = null): string
    {
        $asKey ??= openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $asPublic = self::publicPoint($asKey);
        $salt ??= random_bytes(16);

        $peer = openssl_pkey_get_public(self::pointToPem($uaPublic));
        if ($peer === false) {
            throw new \RuntimeException('Invalid subscription public key.');
        }
        $shared = openssl_pkey_derive($peer, $asKey, 32);
        if ($shared === false) {
            throw new \RuntimeException('ECDH failed: ' . openssl_error_string());
        }

        // hash_hkdf() is extract(salt, ikm) then expand(info, length).
        $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . $uaPublic . $asPublic, $authSecret);
        $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);

        // One record; the trailing 0x02 marks it as the last one.
        $tag = '';
        $cipher = openssl_encrypt($plaintext . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
        if ($cipher === false) {
            throw new \RuntimeException('Encryption failed.');
        }

        return $salt . pack('N', 4096) . chr(strlen($asPublic)) . $asPublic . $cipher . $tag;
    }

    public static function vapidJwt(string $privatePem, string $audience, string $subject, ?int $expires = null): string
    {
        $header = self::b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $claims = self::b64url(json_encode(['aud' => $audience, 'exp' => $expires ?? time() + 12 * 3600, 'sub' => $subject]));
        $input = $header . '.' . $claims;

        if (!openssl_sign($input, $der, $privatePem, OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('Could not sign the VAPID token.');
        }

        return $input . '.' . self::b64url(self::derToRawSignature($der));
    }

    /** openssl signs ECDSA as an ASN.1 SEQUENCE of two INTEGERs; JWT wants r and s as 32 bytes each. */
    private static function derToRawSignature(string $der): string
    {
        $offset = 2;
        if ((ord($der[1]) & 0x80) !== 0) {
            $offset += ord($der[1]) & 0x7f;
        }

        $parts = [];
        for ($i = 0; $i < 2; $i++) {
            $length = ord($der[$offset + 1]);
            $int = substr($der, $offset + 2, $length);
            $parts[] = str_pad(ltrim($int, "\0"), 32, "\0", STR_PAD_LEFT);
            $offset += 2 + $length;
        }

        return $parts[0] . $parts[1];
    }

    /** Uncompressed point (0x04 || X || Y) of an EC key. */
    private static function publicPoint($key): string
    {
        $ec = openssl_pkey_get_details($key)['ec'];
        return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
    }

    /** Wraps a raw P-256 point in the SubjectPublicKeyInfo header openssl expects. */
    private static function pointToPem(string $point): string
    {
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $point;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    public static function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function b64urlDecode(string $data): string
    {
        return (string) base64_decode(strtr($data, '-_', '+/'), true);
    }
}
