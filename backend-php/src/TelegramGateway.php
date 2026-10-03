<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * The only class that talks to Telegram: the owner's bot that says "something
 * happened on the site" (a payment waiting, a ticket, an error). Everything
 * else calls TelegramGateway::send(); nothing else knows the API's shape.
 *
 * The bot token, the chat to write to and, optionally, a relay address come
 * from /admin/settings (group 'telegram'). The relay exists because hosts in
 * Iran often cannot reach api.telegram.org: point api_base at a forwarder
 * outside the country and nothing else changes.
 *
 * Best-effort by design: a message is a courtesy copy of something already
 * saved in the panel, so it must never break the request that triggered it.
 * Never throws; send() returns false and lastError() says why. With no token
 * or chat set, send() quietly does nothing, which is what lets this ship
 * before it is configured.
 */
final class TelegramGateway
{
    public const DEFAULT_BASE = 'https://api.telegram.org';

    /** Telegram refuses a text longer than 4096 characters. */
    private const MAX_TEXT = 4000;
    private const MAX_CAPTION = 1000;

    private static string $lastError = '';

    private function __construct()
    {
    }

    /** Both a token and a chat are set. */
    public static function configured(): bool
    {
        $c = self::credentials();
        return $c['bot_token'] !== '' && $c['chat_id'] !== '';
    }

    /**
     * A message in Telegram's HTML flavour: the caller escapes anything a
     * user typed with esc() and may use <b>, <i>, <code> and <a href>.
     */
    public static function send(string $html): bool
    {
        self::$lastError = '';
        $c = self::credentials();
        if ($c['bot_token'] === '' || $c['chat_id'] === '') {
            self::$lastError = 'telegram not configured';
            return false;
        }

        return self::call($c, 'sendMessage', [
            'chat_id'                  => $c['chat_id'],
            'text'                     => self::cut($html, self::MAX_TEXT),
            'parse_mode'               => 'HTML',
            'disable_web_page_preview' => 'true',
        ]);
    }

    /**
     * A file from this server's disk (a receipt) with a caption. Uploaded as
     * bytes, so the file never needs a public address. Images go as photos,
     * anything else as a document.
     */
    public static function sendFile(string $path, string $html): bool
    {
        self::$lastError = '';
        $c = self::credentials();
        if ($c['bot_token'] === '' || $c['chat_id'] === '') {
            self::$lastError = 'telegram not configured';
            return false;
        }
        if (!is_file($path) || !is_readable($path) || !class_exists('CURLFile')) {
            self::$lastError = 'file not readable';
            return false;
        }

        $mime = function_exists('mime_content_type') ? (string) mime_content_type($path) : '';
        $isImage = in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true);
        $field = $isImage ? 'photo' : 'document';

        return self::call($c, $isImage ? 'sendPhoto' : 'sendDocument', [
            'chat_id'    => $c['chat_id'],
            'caption'    => self::cut($html, self::MAX_CAPTION),
            'parse_mode' => 'HTML',
            $field       => new \CURLFile($path, $mime !== '' ? $mime : null, basename($path)),
        ]);
    }

    /** Text a user typed, made safe to put inside a message. */
    public static function esc(?string $text): string
    {
        return htmlspecialchars((string) $text, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** Why the last send failed (empty after a success). The token is never in it. */
    public static function lastError(): string
    {
        return self::$lastError;
    }

    /** @return array{bot_token: string, chat_id: string, api_base: string} */
    public static function credentials(): array
    {
        $panel = Settings::get('telegram');
        $base = rtrim((string) $panel['api_base'], '/');

        return [
            'bot_token' => (string) $panel['bot_token'],
            'chat_id'   => (string) $panel['chat_id'],
            'api_base'  => $base !== '' ? $base : self::DEFAULT_BASE,
        ];
    }

    /** @param array<string, mixed> $c @param array<string, mixed> $fields */
    private static function call(array $c, string $method, array $fields): bool
    {
        if (!function_exists('curl_init')) {
            self::$lastError = 'curl extension missing';
            return false;
        }

        try {
            $ch = curl_init($c['api_base'] . '/bot' . $c['bot_token'] . '/' . $method);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $fields,
                CURLOPT_RETURNTRANSFER => true,
                // Short on purpose: when Telegram is unreachable the user who
                // triggered this must not wait for it.
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_TIMEOUT        => 8,
            ]);
            $response = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
        } catch (\Throwable $e) {
            self::$lastError = 'telegram: ' . self::scrub($e->getMessage(), $c['bot_token']);
            return false;
        }

        if ($response === false) {
            self::$lastError = 'telegram transport: ' . self::scrub($curlError, $c['bot_token']);
            return false;
        }

        $body = json_decode((string) $response, true);
        if ($status >= 200 && $status < 300 && is_array($body) && ($body['ok'] ?? false) === true) {
            return true;
        }

        $reason = is_array($body) ? (string) ($body['description'] ?? '') : (string) $response;
        self::$lastError = 'telegram rejected (HTTP ' . $status . '): ' . self::scrub(mb_substr($reason, 0, 300), $c['bot_token']);
        return false;
    }

    /** The token sits in the URL, so keep it out of anything that gets stored or shown. */
    private static function scrub(string $text, string $token): string
    {
        return $token === '' ? $text : str_replace($token, '***', $text);
    }

    private static function cut(string $text, int $max): string
    {
        return mb_strlen($text) > $max ? mb_substr($text, 0, $max - 1) . '…' : $text;
    }
}
