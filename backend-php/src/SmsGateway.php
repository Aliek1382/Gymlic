<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * The only class that knows which SMS provider the site uses. Everything else
 * calls SmsGateway::send(); switching provider means rewriting deliver() here
 * and nothing else.
 *
 * Provider today: Melipayamak, the token ("console") REST API. The token and
 * the sender line number come from /admin/settings when the admin set them
 * there, otherwise from config 'sms' => 'api_key' / 'sender'.
 *
 * Never throws. On failure send() returns false and lastError() says why, so
 * the cron can store it in notification_deliveries.last_error.
 */
final class SmsGateway
{
    private static string $lastError = '';

    public static function send(string $phone, string $text): bool
    {
        self::$lastError = '';

        ['api_key' => $apiKey, 'sender' => $sender] = self::credentials();
        if ($apiKey === '' || $sender === '') {
            self::$lastError = 'sms not configured';
            return false;
        }

        $to = self::normalizePhone($phone);
        if ($to === null) {
            self::$lastError = 'invalid phone number';
            return false;
        }

        try {
            return self::deliver($apiKey, $sender, $to, $text);
        } catch (\Throwable $e) {
            self::$lastError = 'sms: ' . $e->getMessage();
            return false;
        }
    }

    /**
     * Each value from the admin's settings when set there, else from
     * config.php ('CHANGE_ME' counting as unset).
     *
     * @return array{api_key: string, sender: string, api_key_source: string, sender_source: string}
     */
    public static function credentials(): array
    {
        $file = (require __DIR__ . '/../config.php')['sms'] ?? [];
        $panel = Settings::get('sms');

        $out = [];
        foreach (['api_key', 'sender'] as $field) {
            $fromFile = (string) ($file[$field] ?? '');
            if ($panel[$field] !== '') {
                $out[$field] = $panel[$field];
                $out[$field . '_source'] = 'panel';
            } elseif ($fromFile !== '' && $fromFile !== 'CHANGE_ME') {
                $out[$field] = $fromFile;
                $out[$field . '_source'] = 'config';
            } else {
                $out[$field] = '';
                $out[$field . '_source'] = 'none';
            }
        }
        return $out;
    }

    /** Why the last send() returned false (empty after a success). */
    public static function lastError(): string
    {
        return self::$lastError;
    }

    /** Iranian mobile in the 09xxxxxxxxx form providers expect, or null. Accepts Persian digits and +98. */
    public static function normalizePhone(string $phone): ?string
    {
        $digits = strtr($phone, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        $digits = preg_replace('/\D+/', '', $digits) ?? '';
        if (str_starts_with($digits, '0098')) {
            $digits = '0' . substr($digits, 4);
        } elseif (str_starts_with($digits, '98')) {
            $digits = '0' . substr($digits, 2);
        } elseif (str_starts_with($digits, '9')) {
            $digits = '0' . $digits;
        }

        return preg_match('/^09\d{9}$/', $digits) === 1 ? $digits : null;
    }

    private static function deliver(string $apiKey, string $sender, string $to, string $text): bool
    {
        if (!function_exists('curl_init')) {
            self::$lastError = 'curl extension missing';
            return false;
        }

        $ch = curl_init('https://console.melipayamak.com/api/send/simple/' . rawurlencode($apiKey));
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode(['from' => $sender, 'to' => $to, 'text' => $text], JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            self::$lastError = 'sms transport: ' . $curlError;
            return false;
        }

        $body = json_decode((string) $response, true);
        $recId = is_array($body) ? (string) ($body['recId'] ?? '') : '';
        // A queued message comes back with a positive recId; anything else is a refusal.
        if ($status >= 200 && $status < 300 && $recId !== '' && $recId !== '0' && !str_starts_with($recId, '-')) {
            return true;
        }

        $reason = is_array($body) ? (string) ($body['status'] ?? '') : '';
        self::$lastError = 'sms rejected (HTTP ' . $status . '): ' . mb_substr($reason !== '' ? $reason : (string) $response, 0, 300);
        return false;
    }
}
