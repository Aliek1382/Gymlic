<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

final class AdminController
{
    // ---- Club-side: filing a payment claim -------------------------------

    /** submit_payment_request (0023): a club owner files an offline payment. */
    public static function submitPaymentRequest(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['plan_id', 'amount_toman']);

        $pdo = Database::connection();

        $club = $pdo->prepare('SELECT id FROM clubs WHERE owner_id = :owner_id');
        $club->execute(['owner_id' => $user['id']]);
        $clubRow = $club->fetch();

        if ($clubRow === false) {
            Response::error(403, 'forbidden', 'Only a club owner can submit a payment request.');
            return;
        }

        $plan = $pdo->prepare('SELECT id FROM plans WHERE id = :id AND is_active = 1');
        $plan->execute(['id' => $data['plan_id']]);
        if ($plan->fetch() === false) {
            Response::error(404, 'plan_not_found', 'That plan is not available.');
            return;
        }

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO payment_requests (id, club_id, plan_id, submitted_by, amount_toman, reference_note)
             VALUES (:id, :club_id, :plan_id, :submitted_by, :amount_toman, :reference_note)'
        )->execute([
            'id'             => $id,
            'club_id'        => $clubRow['id'],
            'plan_id'        => (string) $data['plan_id'],
            'submitted_by'   => $user['id'],
            'amount_toman'   => (int) $data['amount_toman'],
            'reference_note' => Validate::nullableString($data['reference_note'] ?? null),
        ]);

        Response::ok(['id' => $id], 201);
    }

    /** The plan catalogue, readable by any signed-in user (RLS allowed all). */
    public static function listPlans(): void
    {
        Auth::requireUser();

        $stmt = Database::connection()->query(
            'SELECT id, name, price_toman, duration_days, max_members, is_active
             FROM plans ORDER BY price_toman ASC'
        );

        Response::ok([
            'items' => Cast::rows($stmt->fetchAll(), [], ['price_toman', 'duration_days', 'max_members'], ['is_active']),
        ]);
    }

    /** A club owner's own requests; a platform admin sees every club's. */
    public static function listPaymentRequests(): void
    {
        $user = Auth::requireUser();
        $isAdmin = (int) $user['is_platform_admin'] === 1;

        $sql =
            'SELECT pr.id, pr.club_id, pr.plan_id, pr.amount_toman, pr.reference_note, pr.status,
                    pr.admin_note, pr.reviewed_at, pr.created_at,
                    c.name AS club_name, p.name AS plan_name
             FROM payment_requests pr
             JOIN clubs c ON c.id = pr.club_id
             JOIN plans p ON p.id = pr.plan_id';
        $bind = [];

        if (!$isAdmin) {
            $sql .= ' WHERE c.owner_id = :owner_id';
            $bind['owner_id'] = $user['id'];
        }
        $sql .= ' ORDER BY pr.created_at DESC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($bind);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['amount_toman'])]);
    }

    // ---- Platform admin --------------------------------------------------

    /**
     * approve_payment_request (0023/0024): extends or starts the club's
     * subscription and copies the plan's member cap onto the club, all in one
     * transaction with the request row locked so a double click can't grant
     * two subscription periods.
     */
    public static function approvePaymentRequest(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare(
                "SELECT pr.*, p.name AS plan_name, p.duration_days, p.max_members
                 FROM payment_requests pr
                 JOIN plans p ON p.id = pr.plan_id
                 WHERE pr.id = :id AND pr.status = 'pending' FOR UPDATE"
            );
            $stmt->execute(['id' => $params['id']]);
            $request = $stmt->fetch();

            if ($request === false) {
                throw new \RuntimeException('request_not_pending');
            }

            $existing = $pdo->prepare(
                'SELECT id, expires_at FROM subscriptions WHERE club_id = :club_id ORDER BY expires_at DESC LIMIT 1'
            );
            $existing->execute(['club_id' => $request['club_id']]);
            $subscription = $existing->fetch();

            // Extend from the current expiry when it is still in the future,
            // so approving early doesn't cost the club the remaining days.
            $base = ($subscription !== false && $subscription['expires_at'] > date('Y-m-d H:i:s'))
                ? strtotime($subscription['expires_at'])
                : time();
            $expiresAt = date('Y-m-d H:i:s', strtotime('+' . (int) $request['duration_days'] . ' days', $base));

            if ($subscription !== false) {
                $pdo->prepare(
                    "UPDATE subscriptions SET plan_name = :plan_name, status = 'active', expires_at = :expires_at
                     WHERE id = :id"
                )->execute([
                    'plan_name'  => $request['plan_name'],
                    'expires_at' => $expiresAt,
                    'id'         => $subscription['id'],
                ]);
            } else {
                $pdo->prepare(
                    "INSERT INTO subscriptions (id, club_id, plan_name, status, expires_at)
                     VALUES (:id, :club_id, :plan_name, 'active', :expires_at)"
                )->execute([
                    'id'         => Uuid::v4(),
                    'club_id'    => $request['club_id'],
                    'plan_name'  => $request['plan_name'],
                    'expires_at' => $expiresAt,
                ]);
            }

            $pdo->prepare("UPDATE clubs SET member_capacity = :cap, status = 'active' WHERE id = :id")
                ->execute(['cap' => $request['max_members'], 'id' => $request['club_id']]);

            $pdo->prepare(
                "UPDATE payment_requests SET status = 'approved', admin_note = :note,
                        reviewed_by = :admin, reviewed_at = NOW()
                 WHERE id = :id"
            )->execute([
                'note'  => Validate::nullableString($data['admin_note'] ?? null),
                'admin' => $admin['id'],
                'id'    => $params['id'],
            ]);

            self::logActivity($pdo, $request['club_id'], $admin['id'], $request['submitted_by'], 'payment_request_approved', [
                'request_id' => $params['id'],
                'plan'       => $request['plan_name'],
            ]);

            AuthController::notify(
                $pdo,
                $request['submitted_by'],
                $admin['id'],
                'broadcast',
                'پرداخت تأیید شد',
                'اشتراک باشگاه شما تا ' . substr($expiresAt, 0, 10) . ' فعال شد.',
                '/finance'
            );

            $pdo->commit();
            Response::ok(['ok' => true, 'expires_at' => $expiresAt]);
        } catch (Throwable $e) {
            $pdo->rollBack();

            if ($e->getMessage() === 'request_not_pending') {
                Response::error(409, 'request_not_pending', 'That request is not pending.');
                return;
            }
            throw $e;
        }
    }

    public static function rejectPaymentRequest(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "UPDATE payment_requests SET status = 'rejected', admin_note = :note,
                    reviewed_by = :admin, reviewed_at = NOW()
             WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute([
            'note'  => Validate::nullableString($data['admin_note'] ?? null),
            'admin' => $admin['id'],
            'id'    => $params['id'],
        ]);

        if ($stmt->rowCount() === 0) {
            Response::error(409, 'request_not_pending', 'That request is not pending.');
            return;
        }

        self::logActivity($pdo, null, $admin['id'], null, 'payment_request_rejected', ['request_id' => $params['id']]);

        Response::ok(['ok' => true]);
    }

    public static function setClubStatus(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::required(Validate::body(), ['status']);
        $status = (string) $data['status'];

        if (!in_array($status, ['active', 'suspended', 'pending'], true)) {
            Response::error(400, 'invalid_status', 'status must be active, suspended or pending.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('UPDATE clubs SET status = :status WHERE id = :id');
        $stmt->execute(['status' => $status, 'id' => $params['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Club not found.');
            return;
        }

        self::logActivity($pdo, $params['id'], $admin['id'], null, 'club_status_changed', ['status' => $status]);

        Response::ok(['ok' => true]);
    }

    public static function setProfileSuspended(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();
        $suspended = !empty($data['suspended']);

        $pdo = Database::connection();
        $pdo->prepare('UPDATE profiles SET is_suspended = :suspended WHERE id = :id')
            ->execute(['suspended' => $suspended ? 1 : 0, 'id' => $params['id']]);

        // A suspended account shouldn't keep working from an existing token.
        if ($suspended) {
            $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute(['id' => $params['id']]);
        }

        self::logActivity($pdo, null, $admin['id'], $params['id'], 'profile_suspension_changed', [
            'suspended' => $suspended,
        ]);

        Response::ok(['ok' => true]);
    }

    /**
     * admin_update_profile (0023). account_type and is_platform_admin are
     * deliberately not editable here — that was the privilege-escalation
     * guard in the original function.
     */
    public static function updateProfile(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();

        $fields = [];
        $bind = ['id' => $params['id']];

        foreach (['first_name', 'last_name', 'email', 'phone', 'birth_date'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = Validate::nullableString($data[$key] === null ? null : (string) $data[$key]);
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $pdo = Database::connection();
        $pdo->prepare('UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($bind);

        self::logActivity($pdo, null, $admin['id'], $params['id'], 'profile_updated', array_keys($bind));

        Response::ok(['ok' => true]);
    }

    public static function createPlan(): void
    {
        Auth::requirePlatformAdmin();
        $data = Validate::required(Validate::body(), ['name', 'price_toman', 'duration_days']);

        $id = Uuid::v4();
        Database::connection()->prepare(
            'INSERT INTO plans (id, name, price_toman, duration_days, max_members, is_active)
             VALUES (:id, :name, :price_toman, :duration_days, :max_members, :is_active)'
        )->execute([
            'id'            => $id,
            'name'          => (string) $data['name'],
            'price_toman'   => (int) $data['price_toman'],
            'duration_days' => (int) $data['duration_days'],
            'max_members'   => isset($data['max_members']) && $data['max_members'] !== null
                ? (int) $data['max_members'] : null,
            'is_active'     => array_key_exists('is_active', $data) ? (int) (bool) $data['is_active'] : 1,
        ]);

        Response::ok(['id' => $id], 201);
    }

    public static function updatePlan(array $params): void
    {
        Auth::requirePlatformAdmin();
        $data = Validate::body();

        $fields = [];
        $bind = ['id' => $params['id']];

        foreach (['name', 'price_toman', 'duration_days', 'max_members', 'is_active'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $data[$key];
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE plans SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function listClubs(): void
    {
        Auth::requirePlatformAdmin();

        $stmt = Database::connection()->query(
            "SELECT c.id, c.name, c.status, c.member_capacity, c.created_at,
                    c.owner_id, p.first_name AS owner_first_name, p.last_name AS owner_last_name,
                    s.plan_name, s.status AS subscription_status, s.expires_at,
                    (SELECT COUNT(*) FROM memberships m
                      WHERE m.club_id = c.id AND m.role = 'athlete' AND m.status = 'active') AS member_count
             FROM clubs c
             JOIN profiles p ON p.id = c.owner_id
             LEFT JOIN subscriptions s ON s.club_id = c.id
             ORDER BY c.created_at DESC"
        );

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['member_capacity', 'member_count'])]);
    }

    public static function listProfiles(): void
    {
        Auth::requirePlatformAdmin();

        $type = $_GET['account_type'] ?? null;
        $sql = 'SELECT id, first_name, last_name, email, phone, account_type, birth_date,
                       is_suspended, is_platform_admin, created_at
                FROM profiles';
        $bind = [];

        if ($type !== null && $type !== '') {
            $sql .= ' WHERE account_type = :account_type';
            $bind['account_type'] = $type;
        }
        $sql .= ' ORDER BY created_at DESC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($bind);

        Response::ok([
            'items' => Cast::rows($stmt->fetchAll(), [], [], ['is_suspended', 'is_platform_admin']),
        ]);
    }

    public static function listActivity(): void
    {
        Auth::requirePlatformAdmin();

        $stmt = Database::connection()->query(
            'SELECT a.id, a.club_id, a.actor_id, a.subject_id, a.action, a.metadata, a.created_at,
                    c.name AS club_name
             FROM activity_logs a
             LEFT JOIN clubs c ON c.id = a.club_id
             ORDER BY a.created_at DESC LIMIT 100'
        );

        Response::ok(['items' => Cast::json($stmt->fetchAll())]);
    }

    private static function logActivity(
        PDO $pdo,
        ?string $clubId,
        string $actorId,
        ?string $subjectId,
        string $action,
        array $metadata
    ): void {
        $pdo->prepare(
            'INSERT INTO activity_logs (id, club_id, actor_id, subject_id, action, metadata)
             VALUES (:id, :club_id, :actor_id, :subject_id, :action, :metadata)'
        )->execute([
            'id'         => Uuid::v4(),
            'club_id'    => $clubId,
            'actor_id'   => $actorId,
            'subject_id' => $subjectId,
            'action'     => $action,
            'metadata'   => json_encode($metadata, JSON_UNESCAPED_UNICODE),
        ]);
    }
}
