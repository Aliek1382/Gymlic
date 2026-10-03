<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Templates;
use Gymlic\TrainerVerification;
use Gymlic\Validate;

/**
 * /admin/verifications (users.verify): trainers' certificates waiting for
 * review, and the ones already verified or rejected (see TrainerVerification).
 */
final class AdminVerificationController
{
    /** ?status=pending|verified|rejected|all — trainers with at least one certificate. */
    public static function list(): void
    {
        Auth::requireAdmin('users.verify');
        if (!TrainerVerification::ready()) {
            Response::ok(['ready' => false, 'items' => [], 'counts' => []]);
            return;
        }
        $pdo = Database::connection();
        $status = (string) ($_GET['status'] ?? 'pending');
        $where = "JSON_LENGTH(COALESCE(t.certificates, '[]')) > 0";
        $bind = [];
        if (in_array($status, TrainerVerification::STATUSES, true)) {
            $where .= ' AND t.verification_status = :status';
            $bind['status'] = $status;
        }
        $stmt = $pdo->prepare(
            "SELECT t.trainer_id, t.certificates, t.bio, t.verification_status, t.verification_note,
                    t.verification_requested_at, t.verified_at,
                    p.first_name, p.last_name, p.email, p.phone, p.avatar_url,
                    CONCAT_WS(' ', v.first_name, v.last_name) AS verified_by_name,
                    (SELECT COUNT(*) FROM trainer_athletes ta WHERE ta.trainer_id = t.trainer_id AND ta.status = 'active') AS athletes
             FROM trainer_profiles t
             JOIN profiles p ON p.id = t.trainer_id AND p.account_type = 'trainer'
             LEFT JOIN profiles v ON v.id = t.verified_by
             WHERE {$where}
             ORDER BY (t.verification_status = 'pending') DESC, t.verification_requested_at ASC, t.updated_at DESC
             LIMIT 300"
        );
        $stmt->execute($bind);
        $items = array_map(static function (array $row): array {
            $row['certificates'] = json_decode((string) $row['certificates'], true) ?: [];
            $row['athletes'] = (int) $row['athletes'];
            unset($row['bio']);
            return $row;
        }, $stmt->fetchAll());

        $counts = [];
        foreach ($pdo->query(
            "SELECT verification_status, COUNT(*) AS n FROM trainer_profiles
             WHERE JSON_LENGTH(COALESCE(certificates, '[]')) > 0 GROUP BY verification_status"
        )->fetchAll() as $row) {
            $counts[$row['verification_status']] = (int) $row['n'];
        }

        Response::ok(['ready' => true, 'items' => $items, 'counts' => $counts]);
    }

    /** POST /admin/verifications/{trainerId} — {decision: verify|reject|revoke, note?} */
    public static function decide(array $params): void
    {
        $admin = Auth::requireAdmin('users.verify');
        if (!TrainerVerification::ready()) {
            Response::error(409, 'migration_required', 'تأیید مدارک هنوز فعال نیست. به‌روزرسانی «لاگ خطاها، سطل زباله و تأیید مدارک مربی (فاز ۱۰)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            return;
        }
        $data = Validate::body();
        $decision = (string) ($data['decision'] ?? '');
        $note = Validate::nullableString(mb_substr(trim((string) ($data['note'] ?? '')), 0, 500));
        if (!in_array($decision, ['verify', 'reject', 'revoke'], true)) {
            Response::error(400, 'invalid_decision', 'تصمیم نامعتبر است.');
            return;
        }
        if ($decision === 'reject' && $note === null) {
            Response::error(400, 'note_required', 'دلیل رد را بنویسید تا مربی بداند چه چیزی را درست کند.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT verification_status FROM trainer_profiles WHERE trainer_id = :id');
        $stmt->execute(['id' => $params['trainerId']]);
        $current = $stmt->fetchColumn();
        if ($current === false) {
            Response::error(404, 'not_found', 'رزومهٔ این مربی پیدا نشد.');
            return;
        }

        [$status, $sql] = match ($decision) {
            'verify' => ['verified', "verification_status = 'verified', verification_note = :note, verified_at = NOW(), verified_by = :admin"],
            'reject' => ['rejected', "verification_status = 'rejected', verification_note = :note, verified_at = NULL, verified_by = :admin"],
            'revoke' => ['none', "verification_status = 'none', verification_note = :note, verified_at = NULL, verified_by = :admin"],
        };
        $pdo->prepare("UPDATE trainer_profiles SET {$sql} WHERE trainer_id = :id")
            ->execute(['note' => $note, 'admin' => $admin['id'], 'id' => $params['trainerId']]);

        if ($decision === 'verify' && $current !== 'verified') {
            Templates::notify($pdo, 'trainer_verified', $params['trainerId'], $admin['id'], 'broadcast', [], '/trainer-resume');
        } elseif ($decision === 'reject') {
            Templates::notify($pdo, 'trainer_verification_rejected', $params['trainerId'], $admin['id'], 'broadcast', ['reason' => (string) $note], '/trainer-resume');
        }

        AdminController::logActivity($pdo, null, $admin['id'], $params['trainerId'], 'trainer_verification', [
            'decision' => $decision, 'note' => $note,
        ]);
        Response::ok(['status' => $status]);
    }
}
