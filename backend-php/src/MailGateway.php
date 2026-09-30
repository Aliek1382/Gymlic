<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * Plain-text mail. Uses PHP's mail() (the host's local sendmail) unless
 * config 'mail' => 'smtp' has a host, in which case it talks SMTP directly.
 * No Composer, so the SMTP part is a small raw-socket client (AUTH LOGIN,
 * SSL on 465 or STARTTLS on 587).
 *
 * Never throws. send() returns false and lastError() says why.
 */
final class MailGateway
{
    private static string $lastError = '';

    public static function send(string $email, string $subject, string $body): bool
    {
        self::$lastError = '';

        $email = trim($email);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            self::$lastError = 'invalid email address';
            return false;
        }

        $config = (require __DIR__ . '/../config.php')['mail'] ?? [];
        $fromAddress = self::oneLine((string) ($config['from_address'] ?? 'no-reply@gymlic-panel.ir'));
        $fromName = self::oneLine((string) ($config['from_name'] ?? 'Gymlic'));

        // Subject and From name are non-ASCII, so both need RFC 2047 encoding; the body goes out base64.
        $headers = [
            'From: ' . self::encodeWord($fromName) . ' <' . $fromAddress . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            'Date: ' . date('r'),
        ];
        $encodedSubject = self::encodeWord(self::oneLine($subject));
        $encodedBody = chunk_split(base64_encode($body), 76, "\r\n");

        try {
            $smtp = $config['smtp'] ?? [];
            $host = (string) ($smtp['host'] ?? '');
            if ($host !== '' && $host !== 'CHANGE_ME') {
                return self::viaSmtp($smtp, $fromAddress, $email, $encodedSubject, $headers, $encodedBody);
            }

            if (!function_exists('mail')) {
                self::$lastError = 'mail() is disabled on this host';
                return false;
            }
            $ok = @mail($email, $encodedSubject, $encodedBody, implode("\r\n", $headers), '-f' . $fromAddress);
            if (!$ok) {
                self::$lastError = 'mail() refused the message';
            }
            return $ok;
        } catch (\Throwable $e) {
            self::$lastError = 'mail: ' . $e->getMessage();
            return false;
        }
    }

    public static function lastError(): string
    {
        return self::$lastError;
    }

    /** Header values must never carry a line break (header injection). */
    private static function oneLine(string $value): string
    {
        return trim(preg_replace('/[\r\n]+/', ' ', $value) ?? '');
    }

    private static function encodeWord(string $value): string
    {
        return preg_match('/^[\x20-\x7e]*$/', $value) === 1 ? $value : '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private static function viaSmtp(array $smtp, string $from, string $to, string $subject, array $headers, string $body): bool
    {
        $host = (string) $smtp['host'];
        $port = (int) ($smtp['port'] ?? 465);
        $secure = (string) ($smtp['secure'] ?? 'ssl'); // 'ssl' (port 465) or 'tls' (STARTTLS, port 587)

        $socket = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 10);
        if ($socket === false) {
            self::$lastError = "smtp connect: {$errstr} ({$errno})";
            return false;
        }
        stream_set_timeout($socket, 15);

        try {
            $expect = static function (string $codes) use ($socket): void {
                $line = '';
                do {
                    $line = (string) fgets($socket, 1024);
                } while (strlen($line) >= 4 && $line[3] === '-');
                if ($line === '' || !in_array(substr($line, 0, 3), explode(',', $codes), true)) {
                    throw new \RuntimeException('smtp: ' . trim($line !== '' ? $line : 'no response'));
                }
            };
            $say = static function (string $command, string $codes) use ($socket, $expect): void {
                fwrite($socket, $command . "\r\n");
                $expect($codes);
            };

            $expect('220');
            $say('EHLO gymlic-panel.ir', '250');
            if ($secure === 'tls') {
                $say('STARTTLS', '220');
                if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new \RuntimeException('smtp: STARTTLS failed');
                }
                $say('EHLO gymlic-panel.ir', '250');
            }
            if ((string) ($smtp['user'] ?? '') !== '') {
                $say('AUTH LOGIN', '334');
                $say(base64_encode((string) $smtp['user']), '334');
                $say(base64_encode((string) ($smtp['pass'] ?? '')), '235');
            }
            $say('MAIL FROM:<' . $from . '>', '250');
            $say('RCPT TO:<' . $to . '>', '250,251');
            $say('DATA', '354');

            $message = implode("\r\n", array_merge($headers, ['To: ' . $to, 'Subject: ' . $subject])) . "\r\n\r\n" . $body;
            // Base64 lines never start with a dot, so no dot-stuffing is needed.
            fwrite($socket, $message . "\r\n.\r\n");
            $expect('250');
            $say('QUIT', '221');
            return true;
        } catch (\Throwable $e) {
            self::$lastError = $e->getMessage();
            return false;
        } finally {
            fclose($socket);
        }
    }
}
