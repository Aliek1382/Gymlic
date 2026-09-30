<?php
declare(strict_types=1);

namespace Gymlic;

final class Validate
{
    /** Reads and JSON-decodes the request body, or ends the request with 400. */
    public static function body(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            Response::error(400, 'invalid_json', 'Request body must be valid JSON.');
            exit;
        }
        return $decoded;
    }

    /** Ends the request with 400 if any of $keys is missing/empty from $data. */
    public static function required(array $data, array $keys): array
    {
        $missing = [];
        foreach ($keys as $key) {
            if (!array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') {
                $missing[] = $key;
            }
        }
        if ($missing !== []) {
            Response::error(400, 'missing_fields', 'Missing required field(s): ' . implode(', ', $missing));
            exit;
        }
        return $data;
    }

    public static function email(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /** Empty-string -> NULL, matching migration 0005's fix for unique-index collisions. */
    public static function nullableString(?string $value): ?string
    {
        return ($value === null || $value === '') ? null : $value;
    }

    /**
     * An optional non-negative number: absent/''/null -> null. Anything that
     * is not a number, or is outside 0..$max, ends the request with 400 naming
     * $field — a DECIMAL column would otherwise clamp or reject it as a 500.
     */
    public static function nullableNumber(mixed $value, string $field, float $max): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_int($value) && !is_float($value) && !(is_string($value) && is_numeric($value))) {
            Response::error(400, 'invalid_number', "{$field} must be a number.");
            exit;
        }
        $number = (float) $value;
        if ($number < 0 || $number > $max) {
            Response::error(400, 'out_of_range', "{$field} must be between 0 and {$max}.");
            exit;
        }
        return $number;
    }
}
