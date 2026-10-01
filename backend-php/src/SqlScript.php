<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * Splits a .sql file into single statements, the way phpMyAdmin's SQL tab
 * would run them: `--` and `#` line comments and `/* *\/` blocks dropped,
 * `;` ending a statement only outside quotes. PDO runs one statement per
 * call (native prepares), so the update files can't be sent whole.
 */
final class SqlScript
{
    private function __construct()
    {
    }

    /** @return string[] */
    public static function split(string $sql): array
    {
        $statements = [];
        $current = '';
        $length = strlen($sql);
        $quote = null;

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];
            $next = $sql[$i + 1] ?? '';

            if ($quote !== null) {
                $current .= $char;
                if ($char === '\\' && $quote !== '`') {
                    $current .= $next;
                    $i++;
                } elseif ($char === $quote) {
                    // A doubled quote is an escaped one, not the end.
                    if ($next === $quote) {
                        $current .= $next;
                        $i++;
                    } else {
                        $quote = null;
                    }
                }
                continue;
            }

            if ($char === "'" || $char === '"' || $char === '`') {
                $quote = $char;
                $current .= $char;
                continue;
            }

            // "-- " needs the space (MySQL's rule); a line comment runs to the newline.
            if (($char === '-' && $next === '-' && in_array($sql[$i + 2] ?? "\n", [' ', "\t", "\n", "\r"], true))
                || $char === '#') {
                $end = strpos($sql, "\n", $i);
                $i = $end === false ? $length : $end;
                $current .= "\n";
                continue;
            }

            if ($char === '/' && $next === '*') {
                $end = strpos($sql, '*/', $i + 2);
                $i = $end === false ? $length : $end + 1;
                $current .= ' ';
                continue;
            }

            if ($char === ';') {
                self::push($statements, $current);
                $current = '';
                continue;
            }

            $current .= $char;
        }

        self::push($statements, $current);
        return $statements;
    }

    /** @param string[] $statements */
    private static function push(array &$statements, string $statement): void
    {
        $statement = trim($statement);
        if ($statement !== '') {
            $statements[] = $statement;
        }
    }
}
