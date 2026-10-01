<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\ContentLibrary;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * /admin/content: the ready-made content trainers can copy (ContentLibrary).
 * Templates are published from a trainer's own template (copied, so the
 * trainer can keep changing theirs); techniques and questionnaires can also
 * be written here directly. Needs the content permission.
 */
final class AdminContentController
{
    private const LABEL = [
        'workout'       => 'قالب تمرینی',
        'nutrition'     => 'قالب غذایی',
        'technique'     => 'تکنیک',
        'questionnaire' => 'پرسشنامه',
    ];

    public static function list(): void
    {
        Auth::requireAdmin('content');
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
        Auth::requireAdmin('content');
        $kind = self::kind($params['kind']);
        self::requireReady();
        // Any item, so a trainer's template can be previewed before publishing.
        $detail = ContentLibrary::detail(Database::connection(), $kind, $params['id'], false);
        if ($detail === null) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            return;
        }
        Response::ok($detail);
    }

    /** ?kind=&q= — trainers' own items that could be published. */
    public static function candidates(): void
    {
        Auth::requireAdmin('content');
        $kind = self::kind((string) ($_GET['kind'] ?? ''));
        self::requireReady();
        $q = trim((string) ($_GET['q'] ?? ''));

        [$sql, $titleCol] = match ($kind) {
            'workout' => [
                "SELECT a.id, a.title, a.description, a.assigned_at AS created_at, CONCAT_WS(' ', p.first_name, p.last_name) AS owner_name,
                        (SELECT COUNT(*) FROM workout_plan_days d WHERE d.assignment_id = a.id) AS days
                 FROM workout_assignments a JOIN profiles p ON p.id = a.trainer_id
                 WHERE a.is_template = 1 AND a.is_public = 0", 'a.title'],
            'nutrition' => [
                "SELECT a.id, a.title, a.description, a.assigned_at AS created_at, CONCAT_WS(' ', p.first_name, p.last_name) AS owner_name,
                        (SELECT COUNT(*) FROM nutrition_plan_meals m WHERE m.assignment_id = a.id) AS days
                 FROM nutrition_assignments a JOIN profiles p ON p.id = a.trainer_id
                 WHERE a.is_template = 1 AND a.is_public = 0", 'a.title'],
            'technique' => [
                "SELECT t.id, t.name AS title, t.description, t.created_at, CONCAT_WS(' ', p.first_name, p.last_name) AS owner_name, NULL AS days
                 FROM techniques t JOIN profiles p ON p.id = t.coach_id WHERE t.is_public = 0", 't.name'],
            'questionnaire' => [
                "SELECT x.id, x.title, x.description, x.created_at, CONCAT_WS(' ', p.first_name, p.last_name) AS owner_name,
                        (SELECT COUNT(*) FROM questionnaire_questions qq WHERE qq.questionnaire_id = x.id) AS days
                 FROM questionnaires x JOIN profiles p ON p.id = x.coach_id WHERE x.is_public = 0", 'x.title'],
        };
        $bind = [];
        if ($q !== '') {
            $sql .= " AND ({$titleCol} LIKE :q1 OR CONCAT_WS(' ', p.first_name, p.last_name) LIKE :q2)";
            $bind = ['q1' => '%' . $q . '%', 'q2' => '%' . $q . '%'];
        }
        $sql .= ' ORDER BY created_at DESC LIMIT 100';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($bind);
        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['days'])]);
    }

    /** {source_id}: a copy of a trainer's item, made public. */
    public static function publish(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        $kind = self::kind($params['kind']);
        self::requireReady();
        $pdo = Database::connection();

        $source = ContentLibrary::row($pdo, $kind, (string) (Validate::body()['source_id'] ?? ''));
        if ($source === null || (bool) $source['is_public']) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            return;
        }
        if (in_array($kind, ['workout', 'nutrition'], true)) {
            $private = ContentLibrary::privateLibraryItems($pdo, $kind, $source['id']);
            if ($private !== []) {
                Response::error(
                    409,
                    'private_library_items',
                    'این قالب از ' . ($kind === 'workout' ? 'حرکت‌های' : 'غذاهای') . ' شخصی همان مربی استفاده می‌کند که مربی‌های دیگر ندارند: «'
                    . implode('»، «', array_slice($private, 0, 8)) . '». اول آن‌ها را در «کتابخانه‌ها» به بانک عمومی منتقل کنید.'
                );
                return;
            }
        }

        $pdo->beginTransaction();
        try {
            $id = ContentLibrary::copy($pdo, $kind, $source['id'], $admin['id'], true);
            AdminController::logActivity($pdo, null, $admin['id'], $source['owner_id'], 'content_published', [
                'kind'  => $kind,
                'title' => $source['title'] ?? $source['name'],
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::ok(['id' => $id], 201);
    }

    /** A technique or questionnaire written here: {name|title, description, questions?}. */
    public static function create(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        $kind = self::kind($params['kind']);
        self::requireReady();
        if (!in_array($kind, ['technique', 'questionnaire'], true)) {
            Response::error(400, 'publish_only', 'قالب‌ها از قالب‌های مربی‌ها منتشر می‌شوند.');
            return;
        }
        $data = Validate::body();
        $pdo = Database::connection();
        $id = Uuid::v4();
        $title = self::title($data[$kind === 'technique' ? 'name' : 'title'] ?? null);
        $description = Validate::nullableString(trim((string) ($data['description'] ?? '')));
        // Validated before anything is written: a bad question ends the request.
        $questions = $kind === 'questionnaire' ? QuestionnaireController::questions($data['questions'] ?? null) : [];

        $pdo->beginTransaction();
        try {
            if ($kind === 'technique') {
                self::insertTechnique($pdo, $id, $admin['id'], $title, $description);
            } else {
                $pdo->prepare(
                    'INSERT INTO questionnaires (id, coach_id, title, description, price_toman, is_active, is_public)
                     VALUES (:id, :coach_id, :title, :description, NULL, 1, 1)'
                )->execute(['id' => $id, 'coach_id' => $admin['id'], 'title' => $title, 'description' => $description]);
                QuestionnaireController::insertQuestions($id, $questions);
            }
            AdminController::logActivity($pdo, null, $admin['id'], null, 'content_saved', ['kind' => $kind, 'title' => $title]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::ok(['id' => $id], 201);
    }

    /** Title/name and description of any public item; a questionnaire's questions too. */
    public static function update(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        $kind = self::kind($params['kind']);
        self::requireReady();
        $pdo = Database::connection();
        $row = ContentLibrary::row($pdo, $kind, $params['id']);
        if ($row === null || !(bool) $row['is_public']) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            return;
        }
        $data = Validate::body();
        $title = self::title($data[$kind === 'technique' ? 'name' : 'title'] ?? null);
        $description = Validate::nullableString(trim((string) ($data['description'] ?? '')));
        $questions = $kind === 'questionnaire' && array_key_exists('questions', $data)
            ? QuestionnaireController::questions($data['questions'])
            : null;

        $pdo->beginTransaction();
        try {
            if ($kind === 'technique') {
                try {
                    $pdo->prepare('UPDATE techniques SET name = :name, description = :description WHERE id = :id')
                        ->execute(['name' => $title, 'description' => $description, 'id' => $row['id']]);
                } catch (\PDOException $e) {
                    if ($e->getCode() === '23000') {
                        $pdo->rollBack();
                        Response::error(409, 'technique_exists', 'تکنیکی با همین نام هست.');
                        return;
                    }
                    throw $e;
                }
            } else {
                $table = match ($kind) {
                    'workout' => 'workout_assignments', 'nutrition' => 'nutrition_assignments', default => 'questionnaires',
                };
                $pdo->prepare("UPDATE {$table} SET title = :title, description = :description WHERE id = :id")
                    ->execute(['title' => $title, 'description' => $description, 'id' => $row['id']]);
                // Public questionnaires are never answered (trainers answer
                // their copies), so the questions can always be replaced.
                if ($questions !== null) {
                    $pdo->prepare('DELETE FROM questionnaire_questions WHERE questionnaire_id = :id')->execute(['id' => $row['id']]);
                    QuestionnaireController::insertQuestions($row['id'], $questions);
                }
            }
            AdminController::logActivity($pdo, null, $admin['id'], null, 'content_saved', ['kind' => $kind, 'title' => $title]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        Response::ok(['ok' => true]);
    }

    /** Removes a public item; copies trainers already made are theirs and stay. */
    public static function delete(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        $kind = self::kind($params['kind']);
        self::requireReady();
        $pdo = Database::connection();
        $row = ContentLibrary::row($pdo, $kind, $params['id']);
        if ($row === null || !(bool) $row['is_public']) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            return;
        }
        $table = match ($kind) {
            'workout' => 'workout_assignments', 'nutrition' => 'nutrition_assignments', 'technique' => 'techniques', default => 'questionnaires',
        };
        $pdo->prepare("DELETE FROM {$table} WHERE id = :id")->execute(['id' => $row['id']]);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'content_deleted', [
            'kind'  => $kind,
            'title' => $row['title'] ?? $row['name'],
        ]);
        Response::ok(['ok' => true]);
    }

    private static function insertTechnique(PDO $pdo, string $id, string $ownerId, string $name, ?string $description): void
    {
        $taken = $pdo->prepare('SELECT 1 FROM techniques WHERE coach_id = :coach_id AND name = :name');
        $taken->execute(['coach_id' => $ownerId, 'name' => $name]);
        if ($taken->fetch() !== false) {
            $pdo->rollBack();
            Response::error(409, 'technique_exists', 'تکنیکی با همین نام هست.');
            exit;
        }
        $pdo->prepare(
            'INSERT INTO techniques (id, coach_id, name, description, is_public) VALUES (:id, :coach_id, :name, :description, 1)'
        )->execute(['id' => $id, 'coach_id' => $ownerId, 'name' => $name, 'description' => $description]);
    }

    private static function title(mixed $value): string
    {
        $title = trim(is_string($value) ? $value : '');
        if ($title === '' || mb_strlen($title) > 255) {
            Response::error(400, 'invalid_title', 'نام یا عنوان را وارد کنید (حداکثر ۲۵۵ نویسه).');
            exit;
        }
        return $title;
    }

    private static function kind(string $kind): string
    {
        if (!isset(self::LABEL[$kind])) {
            Response::error(404, 'not_found', 'Unknown content kind.');
            exit;
        }
        return $kind;
    }

    private static function requireReady(): void
    {
        if (!ContentLibrary::ready()) {
            Response::error(503, 'content_not_ready', 'محتوای آماده هنوز فعال نیست. به‌روزرسانی «محتوای آماده برای مربی‌ها و عکس و ویدیوی حرکات (فاز ۸)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            exit;
        }
    }
}
