<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

final class Database
{
    private static ?PDO $instance = null;

    public static function connection(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $config = require __DIR__ . '/../config.php';
        $db = $config['db'];

        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $db['host'],
            $db['name'],
            $db['charset']
        );

        self::$instance = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);

        return self::$instance;
    }

    /** @var array<string, bool> */
    private static array $columns = [];

    /** @var array<string, bool> */
    private static array $tables = [];

    /** Whether a table exists yet; same idea as hasColumn(). */
    public static function hasTable(string $table): bool
    {
        if (!isset(self::$tables[$table])) {
            try {
                $stmt = self::connection()->prepare(
                    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
                );
                $stmt->execute(['table' => $table]);
                self::$tables[$table] = $stmt->fetch() !== false;
            } catch (\Throwable $e) {
                self::$tables[$table] = false;
            }
        }
        return self::$tables[$table];
    }

    /**
     * Whether a column exists yet — for code that has to keep working on a
     * database whose ALTER hasn't been run (the backend can reach the host
     * before its SQL does). Checked once per request per column.
     */
    public static function hasColumn(string $table, string $column): bool
    {
        $key = $table . '.' . $column;
        if (!isset(self::$columns[$key])) {
            try {
                $stmt = self::connection()->prepare(
                    'SELECT 1 FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
                );
                $stmt->execute(['table' => $table, 'column' => $column]);
                self::$columns[$key] = $stmt->fetch() !== false;
            } catch (\Throwable $e) {
                self::$columns[$key] = false;
            }
        }
        return self::$columns[$key];
    }
}
