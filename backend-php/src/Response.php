<?php
declare(strict_types=1);

namespace Gymlic;

final class Response
{
    public static function json(int $status, array $payload): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function ok(array $data = [], int $status = 200): void
    {
        self::json($status, $data);
    }

    public static function error(int $status, string $code, string $message): void
    {
        self::json($status, [
            'error' => [
                'code'    => $code,
                'message' => $message,
            ],
        ]);
    }
}
