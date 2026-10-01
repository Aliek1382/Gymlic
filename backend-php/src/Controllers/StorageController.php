<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Storage;
use Gymlic\Validate;

/** /admin/storage (system permission): space used per account, and removing files nothing points to (see Storage). */
final class StorageController
{
    public static function overview(): void
    {
        Auth::requireAdmin('system');
        Response::ok(Storage::overview(Database::connection()));
    }

    /** {paths: string[]} the chosen orphans, or {all: true} every orphan. */
    public static function clean(): void
    {
        $admin = Auth::requireAdmin('system');
        $data = Validate::body();
        $all = ($data['all'] ?? false) === true;
        $paths = is_array($data['paths'] ?? null) ? array_slice($data['paths'], 0, 1000) : [];
        if (!$all && $paths === []) {
            Response::error(400, 'nothing_selected', 'فایلی انتخاب نشده است.');
            return;
        }
        $pdo = Database::connection();
        $result = Storage::clean($pdo, $all ? null : $paths);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'storage_cleaned', $result);
        Response::ok($result);
    }
}
