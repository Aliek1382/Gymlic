<?php
declare(strict_types=1);

namespace Gymlic;

use FilesystemIterator;
use PDO;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * The uploads folder as the admin sees it (/admin/storage): how much each
 * account uses (every account uploads into uploads/<user id>/), and the
 * files nothing points to any more: a certificate uploaded but never saved,
 * a replaced picture, the folder of an account deleted for good.
 *
 * A file counts as an orphan only when no column that stores upload URLs
 * names it, no recycle-bin item still names it, and it is more than a day old
 * (a file is written a moment before the row that points to it). Payment
 * receipts are not looked at here: Receipts keeps and removes those itself.
 */
final class Storage
{
    /** Folders in uploads/ that are not one account's. receipts is Receipts'. */
    private const SYSTEM_FOLDERS = ['library' => 'رسانهٔ حرکات کتابخانه', 'branding' => 'لوگوی سایت', 'receipts' => 'رسیدهای پرداخت'];

    /** Never offered for removal (managed elsewhere, or not files of ours). */
    private const NEVER_ORPHAN = ['receipts'];

    /** table => columns holding upload URLs (a JSON column is searched as text). */
    private const URL_COLUMNS = [
        'profiles'         => ['avatar_url'],
        'clubs'            => ['logo_url'],
        'messages'         => ['media_url'],
        'trainer_profiles' => ['certificates'],
        'exercises'        => ['image_url', 'video_url'],
        'supplements'      => ['image_url'],
        'app_settings'     => ['value'],
    ];

    private const GRACE_SECONDS = 86400;

    private const ORPHAN_LIST_LIMIT = 300;

    private function __construct()
    {
    }

    public static function dir(): string
    {
        $config = require __DIR__ . '/../config.php';
        return rtrim((string) $config['uploads']['dir'], '/');
    }

    /**
     * @return array{
     *   total_bytes: int, total_files: int,
     *   folders: list<array<string, mixed>>,
     *   orphans: array{count: int, bytes: int, items: list<array{path: string, bytes: int, modified_at: string}>}
     * }
     */
    public static function overview(PDO $pdo): array
    {
        $scan = self::scan($pdo);
        $orphans = array_values($scan['orphans']);
        usort($orphans, static fn (array $a, array $b): int => $b['bytes'] <=> $a['bytes']);

        return [
            'total_bytes' => array_sum(array_column($scan['folders'], 'bytes')),
            'total_files' => array_sum(array_column($scan['folders'], 'files')),
            'folders'     => $scan['folders'],
            'orphans'     => [
                'count' => count($orphans),
                'bytes' => array_sum(array_column($orphans, 'bytes')),
                'items' => array_slice($orphans, 0, self::ORPHAN_LIST_LIMIT),
            ],
        ];
    }

    /**
     * Deletes orphans, re-checked right now (a file that became referenced
     * since the page was opened stays). $paths null = all of them.
     *
     * @return array{deleted: int, freed_bytes: int}
     */
    public static function clean(PDO $pdo, ?array $paths): array
    {
        $orphans = self::scan($pdo)['orphans'];
        $targets = $paths === null
            ? array_keys($orphans)
            : array_values(array_filter(array_map('strval', $paths), static fn (string $p): bool => isset($orphans[$p])));

        $dir = self::dir();
        $deleted = 0;
        $freed = 0;
        foreach ($targets as $path) {
            if (!self::isSafePath($path)) {
                continue;
            }
            if (@unlink("{$dir}/{$path}")) {
                $deleted++;
                $freed += $orphans[$path]['bytes'];
            }
        }
        self::removeEmptyFolders($dir);
        return ['deleted' => $deleted, 'freed_bytes' => $freed];
    }

    /**
     * Every folder with its size, and every orphan keyed by its path.
     *
     * @return array{folders: list<array<string, mixed>>, orphans: array<string, array{path: string, bytes: int, modified_at: string}>}
     */
    private static function scan(PDO $pdo): array
    {
        $dir = self::dir();
        $referenced = self::referenced($pdo);
        $users = self::users($pdo);
        $inTrash = array_flip(Trash::userIds($pdo));

        $folders = [];
        $orphans = [];
        foreach (is_dir($dir) ? scandir($dir) : [] as $name) {
            if ($name === '.' || $name === '..' || !is_dir("{$dir}/{$name}")) {
                continue;
            }
            $isUser = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $name) === 1;
            $user = $isUser ? ($users[$name] ?? null) : null;
            $kept = in_array($name, self::NEVER_ORPHAN, true) || isset($inTrash[$name]);
            // The folder of an account deleted for good: all of it is an orphan.
            $gone = $isUser && $user === null && !isset($inTrash[$name]);

            $bytes = 0;
            $files = 0;
            foreach (self::files("{$dir}/{$name}") as $relative => [$size, $mtime]) {
                $bytes += $size;
                $files++;
                $path = "{$name}/{$relative}";
                if (!$kept && ($gone || !isset($referenced[$path])) && $mtime < time() - self::GRACE_SECONDS) {
                    $orphans[$path] = ['path' => $path, 'bytes' => $size, 'modified_at' => date('Y-m-d H:i:s', $mtime)];
                }
            }

            $folders[] = [
                'folder'   => $name,
                'kind'     => $isUser ? 'user' : (isset(self::SYSTEM_FOLDERS[$name]) ? 'system' : 'other'),
                'label'    => self::SYSTEM_FOLDERS[$name] ?? null,
                'user'     => $user,
                'in_trash' => isset($inTrash[$name]),
                'deleted'  => $gone,
                'bytes'    => $bytes,
                'files'    => $files,
            ];
        }
        usort($folders, static fn (array $a, array $b): int => $b['bytes'] <=> $a['bytes']);

        return ['folders' => $folders, 'orphans' => $orphans];
    }

    /** A deleted account's whole folder (Trash, when its item is purged). */
    public static function removeUserFolder(string $userId): void
    {
        if (preg_match('/^[0-9a-f-]{36}$/i', $userId) !== 1) {
            return;
        }
        $folder = self::dir() . '/' . $userId;
        if (!is_dir($folder)) {
            return;
        }
        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($folder);
    }

    /** Bytes in one account's folder. */
    public static function userBytes(string $userId): int
    {
        $folder = self::dir() . '/' . $userId;
        $bytes = 0;
        foreach (is_dir($folder) ? self::files($folder) : [] as [$size]) {
            $bytes += $size;
        }
        return $bytes;
    }

    /** @return array<string, true> "folder/file" => true for every file something names */
    private static function referenced(PDO $pdo): array
    {
        $config = require __DIR__ . '/../config.php';
        $prefix = preg_quote(rtrim((string) $config['uploads']['public_url'], '/'), '#');
        $found = [];
        foreach (self::URL_COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                if (!Database::hasColumn($table, $column)) {
                    continue;
                }
                $stmt = $pdo->query("SELECT `{$column}` FROM `{$table}` WHERE `{$column}` LIKE '%uploads%'");
                foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $value) {
                    $text = str_replace('\\/', '/', (string) $value);
                    if (preg_match_all('#' . $prefix . '/([^"\'?\s<>]+)#', $text, $m)) {
                        foreach ($m[1] as $path) {
                            $found[rawurldecode($path)] = true;
                        }
                    }
                }
            }
        }
        foreach (Trash::referencedUploads($pdo) as $path) {
            $found[$path] = true;
        }
        return $found;
    }

    /** @return array<string, array{id: string, name: string, email: ?string, account_type: ?string}> */
    private static function users(PDO $pdo): array
    {
        $out = [];
        foreach ($pdo->query("SELECT id, CONCAT_WS(' ', first_name, last_name) AS name, email, account_type FROM profiles")->fetchAll() as $row) {
            $out[$row['id']] = $row;
        }
        return $out;
    }

    /** @return array<string, array{0: int, 1: int}> relative path => [bytes, mtime] */
    private static function files(string $folder): array
    {
        $out = [];
        $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS));
        foreach ($items as $item) {
            if ($item->isFile() && $item->getFilename() !== '.htaccess' && $item->getFilename() !== 'index.html') {
                $relative = substr($item->getPathname(), strlen($folder) + 1);
                $out[str_replace('\\', '/', $relative)] = [(int) $item->getSize(), (int) $item->getMTime()];
            }
        }
        return $out;
    }

    /** Inside uploads/, no way out of it. */
    private static function isSafePath(string $path): bool
    {
        return $path !== '' && !str_contains($path, '..') && !str_starts_with($path, '/') && !str_contains($path, '\\')
            && preg_match('#^[A-Za-z0-9._/-]+$#', $path) === 1;
    }

    private static function removeEmptyFolders(string $dir): void
    {
        foreach (is_dir($dir) ? scandir($dir) : [] as $name) {
            $folder = "{$dir}/{$name}";
            if ($name !== '.' && $name !== '..' && is_dir($folder) && !isset(self::SYSTEM_FOLDERS[$name])
                && count(scandir($folder)) === 2) {
                @rmdir($folder);
            }
        }
    }
}
