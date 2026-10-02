<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\ContentLibrary;
use Gymlic\Database;
use Gymlic\Limits;
use Gymlic\Response;
use Throwable;

/**
 * /content-library: the ready-made templates, techniques and questionnaires
 * the admin publishes, which a trainer browses, previews and copies into
 * their own (see ContentLibrary).
 */
final class ContentLibraryController
{
    public static function list(): void
    {
        self::requireTrainer();
        if (!ContentLibrary::ready()) {
            Response::ok(['ready' => false, 'workout' => [], 'nutrition' => [], 'technique' => [], 'questionnaire' => []]);
            return;
        }
        $pdo = Database::connection();
        $out = ['ready' => true];
        foreach (ContentLibrary::KINDS as $kind) {
            $out[$kind] = ContentLibrary::listPublic($pdo, $kind);
        }
        Response::ok($out);
    }

    public static function get(array $params): void
    {
        self::requireTrainer();
        $kind = self::kind($params['kind']);
        $detail = ContentLibrary::ready() ? ContentLibrary::detail(Database::connection(), $kind, $params['id']) : null;
        if ($detail === null) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            return;
        }
        Response::ok($detail);
    }

    /** Makes the trainer's own copy; for a technique they already have by name, that one. */
    public static function copy(array $params): void
    {
        $user = self::requireTrainer();
        $kind = self::kind($params['kind']);
        $pdo = Database::connection();
        $source = ContentLibrary::ready() ? ContentLibrary::row($pdo, $kind, $params['id']) : null;
        if ($source === null || !(bool) $source['is_public']) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            return;
        }

        $pdo->beginTransaction();
        try {
            // A copied workout or nutrition template is one of the trainer's
            // templates, so it counts against their plan's cap (Limits).
            if (in_array($kind, ['workout', 'nutrition'], true)) {
                $limit = Limits::contentBlock($pdo, $user['id'], 'templates');
                if ($limit !== null) {
                    $pdo->rollBack();
                    Response::error(...$limit);
                    return;
                }
            }
            $id = ContentLibrary::copy($pdo, $kind, $source['id'], $user['id'], false);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::ok(['id' => $id], 201);
    }

    /** Every public technique the trainer doesn't have yet (by name), in one go. */
    public static function copyAllTechniques(): void
    {
        $user = self::requireTrainer();
        if (!ContentLibrary::ready()) {
            Response::error(404, 'not_found', 'Not found.');
            return;
        }
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT t.id FROM techniques t
             WHERE t.is_public = 1
               AND NOT EXISTS (SELECT 1 FROM techniques mine WHERE mine.coach_id = :coach_id AND mine.name = t.name)'
        );
        $stmt->execute(['coach_id' => $user['id']]);
        $ids = $stmt->fetchAll(\PDO::FETCH_COLUMN);

        $pdo->beginTransaction();
        try {
            foreach ($ids as $id) {
                ContentLibrary::copy($pdo, 'technique', (string) $id, $user['id'], false);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::ok(['added' => count($ids)]);
    }

    private static function requireTrainer(): array
    {
        $user = Auth::requireUser();
        if ($user['account_type'] !== 'trainer') {
            Response::error(403, 'forbidden', 'این بخش مخصوص مربی‌هاست.');
            exit;
        }
        return $user;
    }

    private static function kind(string $kind): string
    {
        if (!in_array($kind, ContentLibrary::KINDS, true)) {
            Response::error(404, 'not_found', 'Unknown content kind.');
            exit;
        }
        return $kind;
    }
}
