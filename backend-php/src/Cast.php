<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * MySQL hands DECIMAL and BIGINT back as strings over PDO. The frontend types
 * these as numbers, so rows are cast on the way out rather than leaving every
 * caller to coerce them.
 */
final class Cast
{
    /** @param array<int, array<string, mixed>> $rows */
    public static function rows(array $rows, array $floatKeys = [], array $intKeys = [], array $boolKeys = []): array
    {
        foreach ($rows as &$row) {
            $row = self::row($row, $floatKeys, $intKeys, $boolKeys);
        }
        return $rows;
    }

    public static function row(array $row, array $floatKeys = [], array $intKeys = [], array $boolKeys = []): array
    {
        foreach ($floatKeys as $key) {
            if (isset($row[$key])) {
                $row[$key] = (float) $row[$key];
            }
        }
        foreach ($intKeys as $key) {
            if (isset($row[$key])) {
                $row[$key] = (int) $row[$key];
            }
        }
        foreach ($boolKeys as $key) {
            if (array_key_exists($key, $row)) {
                $row[$key] = (bool) $row[$key];
            }
        }
        return $row;
    }

    /** JSON columns: decode to an object so `{}` doesn't serialize back as `[]`. */
    public static function json(array $rows, string $key = 'metadata'): array
    {
        foreach ($rows as &$row) {
            $row[$key] = json_decode($row[$key] ?? '{}') ?? new \stdClass();
        }
        return $rows;
    }
}
