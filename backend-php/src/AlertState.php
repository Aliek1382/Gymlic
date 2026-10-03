<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * What a daily Telegram alert remembers between runs (which day it last ran,
 * what it already announced): one JSON row in app_settings per alert, so no
 * database update is needed. Keys live under "telegram.".
 */
final class AlertState
{
    private function __construct()
    {
    }

    /** @return array<string, mixed> */
    public static function load(PDO $pdo, string $name): array
    {
        $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
        $stmt->execute(['key' => 'telegram.' . $name]);
        $decoded = json_decode((string) $stmt->fetchColumn(), true);

        return is_array($decoded) ? $decoded : [];
    }

    /** @param array<string, mixed> $state */
    public static function save(PDO $pdo, string $name, array $state): void
    {
        $pdo->prepare(
            'INSERT INTO app_settings (setting_key, value) VALUES (:key, :value)
             ON DUPLICATE KEY UPDATE value = VALUES(value)'
        )->execute(['key' => 'telegram.' . $name, 'value' => json_encode($state, JSON_UNESCAPED_UNICODE)]);
    }
}
