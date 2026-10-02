<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\ContentLibrary;
use Gymlic\Database;
use Gymlic\Jalali;
use Gymlic\Limits;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Subscriptions;
use Gymlic\Templates;
use Gymlic\Tiers;
use Gymlic\TrainerBilling;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * The admin's desk for every trainer's and club's plan (see Limits for what
 * a plan allows): one list of both, with the plan, its state, its dates and
 * how much of each cap is used; and, for one account, every change by hand:
 *
 *   activate   — a plan from a start date (today or earlier) to an end date;
 *                optionally records money received outside the site
 *   dates      — the start and end of the current paid plan. An end today
 *                or earlier starts the grace days (an end older than the
 *                grace days ends the plan at once)
 *   extend     — N more days on the same plan
 *   override   — caps of the admin's choosing on this subscription
 *   reactivate — a trainer's suspended athletes back now
 *   revoke_invites — the account's open invites withdrawn
 *
 * Each change can be previewed (`preview: true`: done, measured and rolled
 * back) and is written to the activity log with the state before and after
 * and the admin's note, which is the account's subscription history.
 *
 * Everything here needs plan-limits-update.sql.
 */
final class PlanAccountsController
{
    private const KINDS = ['trainer', 'club'];

    private const ACTIONS = ['activate', 'dates', 'extend', 'override', 'reactivate', 'revoke_invites'];

    /** The activity-log actions that make up one account's subscription history. */
    private const HISTORY_ACTIONS = [
        'plan_activate', 'plan_dates', 'plan_extend', 'plan_override', 'plan_reactivate', 'plan_revoke_invites',
        'trainer_payment_approved', 'trainer_payment_rejected', 'trainer_subscription_granted',
        'payment_request_approved', 'subscription_renewed', 'subscription_gifted', 'subscription_set',
    ];

    private const REPORT_LEVELS = ['count', 'basic', 'full', 'full_excel'];

    // ---- Reading ---------------------------------------------------------

    /** GET /admin/plan-accounts */
    public static function list(): void
    {
        Auth::requireAdmin('finance');
        if (!Limits::ready()) {
            Response::ok(['ready' => false, 'trainers' => [], 'clubs' => []]);
            return;
        }

        $pdo = Database::connection();
        $billing = Settings::get('billing');

        Response::ok([
            'ready'         => true,
            'enforcing'     => Limits::enforcing(),
            'grace_days'    => $billing['grace_days'],
            'expiring_days' => $billing['expiring_days'],
            'trainers'      => self::trainerRows($pdo),
            'clubs'         => self::clubRows($pdo),
            'trainer_plans' => self::trainerPlans($pdo),
            'club_plans'    => self::clubPlans($pdo),
        ]);
    }

    /** GET /admin/plan-accounts/{kind}/{id}: one account and its history. */
    public static function detail(array $params): void
    {
        Auth::requireAdmin('finance');
        if (!self::ready()) {
            return;
        }
        $kind = self::kind($params['kind'] ?? '');
        if ($kind === null) {
            return;
        }

        $pdo = Database::connection();
        $row = self::row($pdo, $kind, $params['id']);
        if ($row === null) {
            Response::error(404, 'not_found', $kind === 'trainer' ? 'مربی پیدا نشد.' : 'باشگاه پیدا نشد.');
            return;
        }

        $placeholders = implode(',', array_fill(0, count(self::HISTORY_ACTIONS), '?'));
        $stmt = $pdo->prepare(
            "SELECT a.id, a.action, a.metadata, a.created_at, a.actor_id,
                    actor.first_name AS actor_first_name, actor.last_name AS actor_last_name
             FROM activity_logs a LEFT JOIN profiles actor ON actor.id = a.actor_id
             WHERE " . ($kind === 'club' ? 'a.club_id = ?' : 'a.subject_id = ? AND a.club_id IS NULL') . "
               AND a.action IN ({$placeholders})
             ORDER BY a.created_at DESC LIMIT 200"
        );
        $stmt->execute(array_merge([$params['id']], self::HISTORY_ACTIONS));
        $history = $stmt->fetchAll();
        foreach ($history as &$entry) {
            $entry['metadata'] = json_decode((string) $entry['metadata'], true);
        }
        unset($entry);

        Response::ok(['account' => $row, 'history' => $history]);
    }

    /**
     * Every trainer with their plan and usage (one query for all of them).
     * With $id, just that trainer.
     *
     * @return list<array<string, mixed>>
     */
    public static function trainerRows(PDO $pdo, ?string $id = null): array
    {
        $stmt = $pdo->prepare(
            "SELECT t.id, t.first_name, t.last_name, t.phone, t.email, t.created_at, " . Limits::TRAINER_COLUMNS . ",
                    (SELECT COUNT(*) FROM trainer_athletes ta WHERE ta.trainer_id = t.id AND ta.club_id IS NULL
                       AND ta.status = 'active' AND ta.suspended_by_plan = 0) AS u_active,
                    (SELECT COUNT(*) FROM trainer_athletes ta WHERE ta.trainer_id = t.id AND ta.club_id IS NULL
                       AND ta.status = 'active' AND ta.suspended_by_plan = 1) AS u_suspended,
                    (SELECT COUNT(*) FROM invitations i WHERE i.trainer_id = t.id AND i.club_id IS NULL
                       AND i.invited_role = 'athlete' AND i.status = 'pending' AND i.expires_at > NOW()) AS u_pending,
                    (SELECT m.club_id FROM memberships m WHERE m.user_id = t.id AND m.role = 'trainer' AND m.status = 'active'
                       ORDER BY m.joined_at ASC LIMIT 1) AS club_id,
                    (SELECT c.name FROM memberships m JOIN clubs c ON c.id = m.club_id
                       WHERE m.user_id = t.id AND m.role = 'trainer' AND m.status = 'active'
                       ORDER BY m.joined_at ASC LIMIT 1) AS club_name,
                    (SELECT MAX(cs.expires_at) FROM subscriptions cs
                       WHERE cs.club_id = (SELECT m.club_id FROM memberships m WHERE m.user_id = t.id AND m.role = 'trainer'
                                             AND m.status = 'active' ORDER BY m.joined_at ASC LIMIT 1)) AS club_expires_at,
                    (SELECT COUNT(*) FROM exercises x WHERE x.created_by = t.id) AS u_exercises,
                    (SELECT COUNT(*) FROM workout_assignments w WHERE w.trainer_id = t.id AND w.is_template = 1" . ContentLibrary::ownOnly('w.') . ")
                    + (SELECT COUNT(*) FROM nutrition_assignments n WHERE n.trainer_id = t.id AND n.is_template = 1" . ContentLibrary::ownOnly('n.') . ") AS u_templates
             FROM profiles t
             LEFT JOIN trainer_subscriptions s ON s.trainer_id = t.id
             LEFT JOIN trainer_plans p ON p.id = s.plan_id
             WHERE t.account_type = 'trainer'" . ($id !== null ? ' AND t.id = :id' : '') . "
             ORDER BY t.created_at DESC LIMIT 5000"
        );
        $stmt->execute($id !== null ? ['id' => $id] : []);

        $out = [];
        foreach ($stmt->fetchAll() as $r) {
            $limits = Limits::trainerShape(
                $pdo,
                $r,
                ['active' => (int) $r['u_active'], 'pending_invites' => (int) $r['u_pending'], 'suspended' => (int) $r['u_suspended']],
                $r['club_id'] !== null ? ['club_id' => $r['club_id'], 'name' => $r['club_name']] : null,
                [
                    'exercises'    => (int) $r['u_exercises'],
                    'templates'    => (int) $r['u_templates'],
                    'club_running' => $r['club_id'] !== null
                        && in_array(Subscriptions::status($r['club_expires_at']), ['active', 'expiring', 'grace'], true),
                ]
            );
            $out[] = [
                'kind'       => 'trainer',
                'id'         => $r['id'],
                'name'       => trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? '')),
                'phone'      => $r['phone'],
                'email'      => $r['email'],
                'created_at' => $r['created_at'],
                'club_name'  => $r['club_name'],
                'limits'     => $limits,
            ];
        }
        return self::withHiddenPlans($pdo, $out);
    }

    /**
     * Each trainer's finished plans hidden by their history limit (phase 3),
     * as limits.history.hidden: one query per distinct cutoff, not per trainer.
     *
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private static function withHiddenPlans(PDO $pdo, array $rows): array
    {
        $byCutoff = [];
        foreach ($rows as $i => $row) {
            $rows[$i]['limits']['history']['hidden'] = 0;
            $cutoff = $row['limits']['history']['cutoff'] ?? null;
            if ($cutoff !== null) {
                $byCutoff[$cutoff][$row['id']] = $i;
            }
        }
        foreach ($byCutoff as $cutoff => $index) {
            $ids = array_keys($index);
            $marks = implode(',', array_fill(0, count($ids), '?'));
            foreach (['workout_assignments', 'nutrition_assignments'] as $table) {
                $stmt = $pdo->prepare(
                    "SELECT trainer_id, COUNT(*) FROM {$table}
                     WHERE trainer_id IN ({$marks}) AND is_template = 0
                       AND status IN (" . Limits::FINISHED_STATUSES . ") AND assigned_at < ?
                     GROUP BY trainer_id"
                );
                $stmt->execute([...$ids, $cutoff]);
                foreach ($stmt->fetchAll(PDO::FETCH_KEY_PAIR) as $trainerId => $count) {
                    $rows[$index[$trainerId]]['limits']['history']['hidden'] += (int) $count;
                }
            }
        }
        return $rows;
    }

    /** @return list<array<string, mixed>> */
    public static function clubRows(PDO $pdo, ?string $id = null): array
    {
        $stmt = $pdo->prepare(
            "SELECT c.id, c.name, c.status AS club_status, c.created_at,
                    o.id AS owner_id, o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.phone AS owner_phone,
                    " . Limits::CLUB_COLUMNS . ",
                    (SELECT COUNT(*) FROM memberships m WHERE m.club_id = c.id AND m.role = 'athlete' AND m.status = 'active') AS u_members,
                    (SELECT COUNT(*) FROM invitations i WHERE i.club_id = c.id AND i.invited_role = 'athlete'
                       AND i.status = 'pending' AND i.expires_at > NOW()) AS u_member_invites,
                    (SELECT COUNT(*) FROM memberships m WHERE m.club_id = c.id AND m.role = 'trainer') AS u_trainers,
                    (SELECT COUNT(*) FROM invitations i WHERE i.club_id = c.id AND i.invited_role = 'trainer'
                       AND i.status = 'pending' AND i.expires_at > NOW()) AS u_trainer_invites
             FROM clubs c
             JOIN profiles o ON o.id = c.owner_id
             LEFT JOIN subscriptions s ON s.id = (SELECT s2.id FROM subscriptions s2 WHERE s2.club_id = c.id ORDER BY s2.expires_at DESC LIMIT 1)
             LEFT JOIN plans p ON p.id = s.plan_id" . ($id !== null ? ' WHERE c.id = :id' : '') . "
             ORDER BY c.created_at DESC LIMIT 5000"
        );
        $stmt->execute($id !== null ? ['id' => $id] : []);

        $out = [];
        foreach ($stmt->fetchAll() as $r) {
            $out[] = [
                'kind'        => 'club',
                'id'          => $r['id'],
                'name'        => $r['name'],
                'club_status' => $r['club_status'],
                'owner_id'    => $r['owner_id'],
                'owner_name'  => trim(($r['owner_first_name'] ?? '') . ' ' . ($r['owner_last_name'] ?? '')),
                'phone'       => $r['owner_phone'],
                'created_at'  => $r['created_at'],
                'limits'      => Limits::clubShape($r, [
                    'members'                 => (int) $r['u_members'],
                    'pending_member_invites'  => (int) $r['u_member_invites'],
                    'trainers'                => (int) $r['u_trainers'],
                    'pending_trainer_invites' => (int) $r['u_trainer_invites'],
                ]),
            ];
        }
        return $out;
    }

    // ---- Changing --------------------------------------------------------

    /** POST /admin/plan-accounts/{kind}/{id} {action, ..., note?, notify?, preview?} */
    public static function update(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::ready()) {
            return;
        }
        $kind = self::kind($params['kind'] ?? '');
        if ($kind === null) {
            return;
        }
        $data = Validate::required(Validate::body(), ['action']);
        $action = (string) $data['action'];
        if (!in_array($action, self::ACTIONS, true) || ($action === 'reactivate' && $kind !== 'trainer')) {
            Response::error(400, 'invalid_action', 'این تغییر برای این حساب معتبر نیست.');
            return;
        }

        $pdo = Database::connection();
        $account = self::row($pdo, $kind, $params['id']);
        if ($account === null) {
            Response::error(404, 'not_found', $kind === 'trainer' ? 'مربی پیدا نشد.' : 'باشگاه پیدا نشد.');
            return;
        }

        $note = mb_substr(trim((string) ($data['note'] ?? '')), 0, 500) ?: null;
        $notify = !array_key_exists('notify', $data) || !empty($data['notify']);
        $preview = !empty($data['preview']);
        $id = $params['id'];

        $pdo->beginTransaction();
        try {
            $before = self::limits($pdo, $kind, $id);
            $outcome = match ($action) {
                'activate'       => self::activate($pdo, $kind, $id, $data, $admin['id'], $note),
                'dates'          => self::dates($pdo, $kind, $id, $data, $before),
                'extend'         => self::extend($pdo, $kind, $id, $data, $before),
                'override'       => self::override($pdo, $kind, $id, $data),
                'reactivate'     => ['log' => ['count' => Limits::reactivate($pdo, $id)]],
                'revoke_invites' => ['log' => ['count' => self::revokeInvites($pdo, $kind, $id)]],
            };
            if (isset($outcome['error'])) {
                $pdo->rollBack();
                Response::error(...$outcome['error']);
                return;
            }

            if ($kind === 'trainer') {
                Limits::resync($pdo, $id);
            }
            $after = self::limits($pdo, $kind, $id);

            if ($preview) {
                $pdo->rollBack();
                Response::ok(['preview' => true, 'before' => $before, 'after' => $after]);
                return;
            }

            AdminController::logActivity(
                $pdo,
                $kind === 'club' ? $id : null,
                $admin['id'],
                $kind === 'club' ? $account['owner_id'] : $id,
                'plan_' . $action,
                [
                    'kind'   => $kind,
                    'name'   => $account['name'],
                    'before' => self::snapshot($before),
                    'after'  => self::snapshot($after),
                    'note'   => $note,
                ] + ($outcome['log'] ?? [])
            );

            if ($notify && in_array($action, ['activate', 'dates', 'extend'], true)) {
                self::notifyChange($pdo, $kind, $kind === 'club' ? $account['owner_id'] : $id, $admin['id'], $after);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['account' => self::row($pdo, $kind, $id)]);
    }

    /** @return array<string, mixed> */
    private static function activate(PDO $pdo, string $kind, string $id, array $data, string $adminId, ?string $note): array
    {
        $plan = self::plan($pdo, $kind, (string) ($data['plan_id'] ?? ''));
        if ($plan === null) {
            return ['error' => [404, 'plan_not_found', 'پلن انتخاب‌شده پیدا نشد.']];
        }

        $startedAt = self::startDate($data['started_at'] ?? null) ?? date('Y-m-d');
        if ($startedAt === false) {
            return ['error' => [400, 'invalid_start', 'تاریخ شروع معتبر نیست و نمی‌تواند در آینده باشد.']];
        }
        $endDate = ($data['expires_at'] ?? '') === ''
            ? date('Y-m-d', (int) strtotime($startedAt . ' +' . (int) $plan['duration_days'] . ' days'))
            : self::date($data['expires_at']);
        if ($endDate === null || $endDate < $startedAt) {
            return ['error' => [400, 'invalid_end', 'تاریخ پایان معتبر نیست؛ نباید قبل از تاریخ شروع باشد.']];
        }

        $amount = $data['amount_toman'] ?? 0;
        if ($amount === '' || $amount === null) {
            $amount = 0;
        }
        if (!is_numeric($amount) || (int) $amount < 0 || (int) $amount > 1_000_000_000_000) {
            return ['error' => [400, 'invalid_amount', 'مبلغ دریافتی معتبر نیست.']];
        }
        $amount = (int) $amount;

        $start = $startedAt . ' ' . ($startedAt === date('Y-m-d') ? date('H:i:s') : '00:00:00');
        $end = $endDate . ' 23:59:59';

        if ($kind === 'trainer') {
            $pdo->prepare(
                'INSERT INTO trainer_subscriptions (trainer_id, plan_id, plan_name, max_athletes, started_at, expires_at)
                 VALUES (:id, :plan_id, :name, :cap, :start, :end)
                 ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), plan_name = VALUES(plan_name),
                   max_athletes = VALUES(max_athletes), started_at = VALUES(started_at), expires_at = VALUES(expires_at),
                   reminder_stage = 0, override_on = 0, override_max_athletes = NULL'
            )->execute(['id' => $id, 'plan_id' => $plan['id'], 'name' => $plan['name'], 'cap' => $plan['cap'], 'start' => $start, 'end' => $end]);
            Limits::restore($pdo, $id);
            Tiers::setTrainerTier($pdo, $id, Tiers::planTier($pdo, 'trainer_plans', $plan['id']));

            if ($amount > 0) {
                $pdo->prepare(
                    "INSERT INTO trainer_payment_requests
                       (id, trainer_id, plan_id, amount_toman, reference_note, tracking_code, card_last4,
                        status, admin_note, reviewed_by, reviewed_at)
                     VALUES (:id, :trainer, :plan, :amount, :ref, :tracking, '0000', 'approved', :note, :admin, NOW())"
                )->execute([
                    'id'       => Uuid::v4(),
                    'trainer'  => $id,
                    'plan'     => $plan['id'],
                    'amount'   => $amount,
                    'ref'      => 'ثبت دستی در پنل مدیریت',
                    'tracking' => 'MANUAL-' . strtoupper(substr(str_replace('-', '', Uuid::v4()), 0, 10)),
                    'note'     => $note,
                    'admin'    => $adminId,
                ]);
            }
        } else {
            Subscriptions::set($pdo, $id, $plan['name'], $end, $plan['id'], $start, true);
            Tiers::setClubTier($pdo, $id, Tiers::planTier($pdo, 'plans', $plan['id']));
            // A paid plan opens a club still waiting for approval, as an
            // approved payment does; a suspended club stays suspended.
            $pdo->prepare("UPDATE clubs SET status = 'active' WHERE id = :id AND status = 'pending'")->execute(['id' => $id]);

            if ($amount > 0) {
                $pdo->prepare(
                    "INSERT INTO payment_requests
                       (id, club_id, plan_id, submitted_by, amount_toman, reference_note, status, admin_note, reviewed_by, reviewed_at)
                     VALUES (:id, :club, :plan, :admin, :amount, :ref, 'approved', :note, :admin2, NOW())"
                )->execute([
                    'id'     => Uuid::v4(),
                    'club'   => $id,
                    'plan'   => $plan['id'],
                    'admin'  => $adminId,
                    'amount' => $amount,
                    'ref'    => 'ثبت دستی در پنل مدیریت',
                    'note'   => $note,
                    'admin2' => $adminId,
                ]);
            }
        }

        return ['log' => ['plan' => $plan['name'], 'started_at' => $start, 'expires_at' => $end, 'amount' => $amount]];
    }

    /** @return array<string, mixed> */
    private static function dates(PDO $pdo, string $kind, string $id, array $data, array $before): array
    {
        $current = self::paidPeriod($pdo, $kind, $id);
        if ($current === null) {
            return ['error' => [409, 'no_paid_plan', 'این حساب پلن پولی ندارد؛ ابتدا یک پلن فعال کنید.']];
        }

        $startedAt = self::startDate($data['started_at'] ?? null);
        if ($startedAt === false) {
            return ['error' => [400, 'invalid_start', 'تاریخ شروع معتبر نیست و نمی‌تواند در آینده باشد.']];
        }
        $endDate = self::date($data['expires_at'] ?? null);
        $effectiveStart = $startedAt ?? substr((string) $current['started_at'], 0, 10);
        if ($endDate === null || $endDate < $effectiveStart) {
            return ['error' => [400, 'invalid_end', 'تاریخ پایان معتبر نیست؛ نباید قبل از تاریخ شروع باشد.']];
        }

        $start = $startedAt === null ? null : $startedAt . ' 00:00:00';
        $end = $endDate . ' 23:59:59';

        if ($kind === 'trainer') {
            $pdo->prepare(
                'UPDATE trainer_subscriptions SET expires_at = :end, reminder_stage = 0'
                . ($start !== null ? ', started_at = :start' : '') . ' WHERE trainer_id = :id'
            )->execute(['end' => $end, 'id' => $id] + ($start !== null ? ['start' => $start] : []));
        } else {
            Subscriptions::set($pdo, $id, (string) $current['plan_name'], $end, null, $start);
        }

        return ['log' => ['started_at' => $start, 'expires_at' => $end]];
    }

    /** @return array<string, mixed> */
    private static function extend(PDO $pdo, string $kind, string $id, array $data, array $before): array
    {
        $days = filter_var($data['days'] ?? null, FILTER_VALIDATE_INT);
        if ($days === false || $days < 1 || $days > 3650) {
            return ['error' => [400, 'invalid_days', 'تعداد روز باید بین ۱ و ۳۶۵۰ باشد.']];
        }
        $current = self::paidPeriod($pdo, $kind, $id);
        if ($current === null) {
            return ['error' => [409, 'no_paid_plan', 'این حساب پلن پولی ندارد؛ ابتدا یک پلن فعال کنید.']];
        }

        $expiresAt = $kind === 'trainer'
            ? TrainerBilling::extend($pdo, $id, $days, (string) $current['plan_name'], self::intOrNull($current['max_athletes']), $current['plan_id'])
            : Subscriptions::extend($pdo, $id, $days, null);

        return ['log' => ['days' => $days, 'expires_at' => $expiresAt]];
    }

    /** @return array<string, mixed> */
    private static function override(PDO $pdo, string $kind, string $id, array $data): array
    {
        $on = !empty($data['on']);
        $caps = [];
        foreach ($kind === 'trainer' ? ['max_athletes'] : ['max_members', 'max_trainers'] as $key) {
            $value = $data[$key] ?? null;
            if ($value === null || $value === '') {
                $caps[$key] = null;
                continue;
            }
            $value = filter_var($value, FILTER_VALIDATE_INT);
            if ($value === false || $value < 0 || $value > 1_000_000) {
                return ['error' => [400, 'invalid_cap', 'سقف باید عددی صحیح و نامنفی باشد، یا خالی برای بدون محدودیت.']];
            }
            $caps[$key] = $value;
        }

        if ($kind === 'trainer') {
            // A trainer on the free plan has no row yet: the override needs one.
            $free = Limits::freePlan($pdo);
            $pdo->prepare(
                'INSERT IGNORE INTO trainer_subscriptions (trainer_id, plan_id, plan_name, max_athletes, started_at, expires_at)
                 VALUES (:id, :plan_id, :name, :cap, NOW(), NULL)'
            )->execute(['id' => $id, 'plan_id' => $free['id'], 'name' => $free['name'], 'cap' => $free['max_athletes']]);
            $pdo->prepare(
                'UPDATE trainer_subscriptions SET override_on = :on, override_max_athletes = :cap WHERE trainer_id = :id'
            )->execute(['on' => $on ? 1 : 0, 'cap' => $on ? $caps['max_athletes'] : null, 'id' => $id]);
        } else {
            $current = Subscriptions::latest($pdo, $id, true);
            if ($current === null) {
                return ['error' => [409, 'no_subscription', 'این باشگاه اشتراکی ندارد؛ ابتدا یک پلن فعال کنید.']];
            }
            $pdo->prepare(
                'UPDATE subscriptions SET override_on = :on, override_max_members = :members, override_max_trainers = :trainers WHERE id = :id'
            )->execute([
                'on'       => $on ? 1 : 0,
                'members'  => $on ? $caps['max_members'] : null,
                'trainers' => $on ? $caps['max_trainers'] : null,
                'id'       => $current['id'],
            ]);
        }

        return ['log' => ['on' => $on] + ($on ? $caps : [])];
    }

    private static function revokeInvites(PDO $pdo, string $kind, string $id): int
    {
        $stmt = $pdo->prepare(
            $kind === 'trainer'
                ? "UPDATE invitations SET status = 'revoked'
                   WHERE trainer_id = :id AND club_id IS NULL AND invited_role = 'athlete' AND status = 'pending'"
                : "UPDATE invitations SET status = 'revoked' WHERE club_id = :id AND status = 'pending'"
        );
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount();
    }

    /** Tells the trainer / club owner where their subscription now stands. */
    private static function notifyChange(PDO $pdo, string $kind, string $recipientId, string $adminId, array $after): void
    {
        $plan = $kind === 'trainer' ? $after['plan']['name'] : $after['plan_name'];
        $expiresAt = $kind === 'trainer' ? ($after['subscription']['expires_at'] ?? null) : $after['expires_at'];
        if ($expiresAt === null) {
            return;
        }
        $running = in_array($after['status'], ['active', 'expiring'], true);
        $vars = ['plan' => (string) $plan, 'date' => Jalali::format($expiresAt, true)];

        if ($kind === 'trainer') {
            $running
                ? Templates::notify($pdo, 'trainer_subscription_changed', $recipientId, $adminId, 'broadcast', $vars, '/subscription')
                : Templates::notify($pdo, 'trainer_subscription_expired', $recipientId, $adminId, 'broadcast', $vars + [
                    'grace_date' => Jalali::format((string) Subscriptions::graceEndsAt($expiresAt), true),
                ], '/subscription');
            return;
        }
        Templates::notify($pdo, $running ? 'subscription_set' : 'subscription_ended', $recipientId, $adminId, 'broadcast', $vars, '/finance');
    }

    // ---- Shared ------------------------------------------------------------

    /**
     * The essentials of a forTrainer / forClub result, for the activity log.
     *
     * @param array<string, mixed> $limits
     * @return array<string, mixed>
     */
    public static function snapshot(array $limits): array
    {
        if (isset($limits['plan']) && is_array($limits['plan'])) {
            return [
                'plan'         => $limits['plan']['name'],
                'status'       => $limits['status'],
                'started_at'   => $limits['subscription']['started_at'] ?? null,
                'expires_at'   => $limits['subscription']['expires_at'] ?? null,
                'max_athletes' => $limits['max_athletes'],
                'override'     => $limits['override'],
                'suspended'    => $limits['usage']['suspended'] ?? 0,
            ];
        }
        return [
            'plan'         => $limits['plan_name'] ?? null,
            'status'       => $limits['status'] ?? null,
            'started_at'   => $limits['started_at'] ?? null,
            'expires_at'   => $limits['expires_at'] ?? null,
            'max_members'  => $limits['max_members'] ?? null,
            'max_trainers' => $limits['max_trainers'] ?? null,
            'override'     => $limits['override'] ?? false,
        ];
    }

    /**
     * The plan columns the later phases read, from an admin's plan form.
     * Only the keys present; an error as ['error' => [code, message]].
     *
     * @return array<string, mixed>
     */
    public static function featureFields(array $data): array
    {
        $out = [];
        foreach (['max_custom_exercises', 'max_templates', 'history_months'] as $key) {
            if (!array_key_exists($key, $data)) {
                continue;
            }
            $value = $data[$key];
            if ($value === null || $value === '') {
                $out[$key] = null;
                continue;
            }
            $value = filter_var($value, FILTER_VALIDATE_INT);
            if ($value === false || $value < 0 || $value > 100000) {
                return ['error' => ['invalid_limit', 'محدودیت‌ها باید عددی صحیح و نامنفی باشند، یا خالی برای بدون محدودیت.']];
            }
            $out[$key] = $value;
        }
        if (array_key_exists('report_level', $data)) {
            $level = $data['report_level'];
            if ($level !== null && $level !== '' && !in_array($level, self::REPORT_LEVELS, true)) {
                return ['error' => ['invalid_report_level', 'سطح گزارش معتبر نیست.']];
            }
            $out['report_level'] = $level === '' ? null : $level;
        }
        return $out;
    }

    /** @return list<array<string, mixed>> */
    private static function trainerPlans(PDO $pdo): array
    {
        $rows = $pdo->query(
            'SELECT id, name, price_toman, duration_days, max_athletes, is_free, is_active FROM trainer_plans
             ORDER BY is_active DESC, price_toman ASC'
        )->fetchAll();
        return \Gymlic\Cast::rows($rows, [], ['price_toman', 'duration_days', 'max_athletes'], ['is_free', 'is_active']);
    }

    /** @return list<array<string, mixed>> */
    private static function clubPlans(PDO $pdo): array
    {
        $rows = $pdo->query(
            'SELECT id, name, price_toman, duration_days, max_members, max_trainers, is_active FROM plans
             ORDER BY is_active DESC, price_toman ASC'
        )->fetchAll();
        return \Gymlic\Cast::rows($rows, [], ['price_toman', 'duration_days', 'max_members', 'max_trainers'], ['is_active']);
    }

    /** @return array<string, mixed>|null */
    private static function row(PDO $pdo, string $kind, string $id): ?array
    {
        $rows = $kind === 'trainer' ? self::trainerRows($pdo, $id) : self::clubRows($pdo, $id);
        return $rows[0] ?? null;
    }

    /** @return array<string, mixed> */
    private static function limits(PDO $pdo, string $kind, string $id): array
    {
        return $kind === 'trainer' ? Limits::forTrainer($pdo, $id) : Limits::forClub($pdo, $id);
    }

    /** A sellable plan for the account: id, name, duration_days, cap. @return array<string, mixed>|null */
    private static function plan(PDO $pdo, string $kind, string $planId): ?array
    {
        $stmt = $pdo->prepare(
            $kind === 'trainer'
                ? 'SELECT id, name, duration_days, max_athletes AS cap FROM trainer_plans WHERE id = :id AND is_free = 0'
                : 'SELECT id, name, duration_days, max_members AS cap FROM plans WHERE id = :id'
        );
        $stmt->execute(['id' => $planId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** The account's paid subscription row (locked), or null. @return array<string, mixed>|null */
    private static function paidPeriod(PDO $pdo, string $kind, string $id): ?array
    {
        if ($kind === 'club') {
            return Subscriptions::latest($pdo, $id, true);
        }
        $stmt = $pdo->prepare(
            'SELECT s.plan_id, s.plan_name, s.max_athletes, s.started_at, s.expires_at
             FROM trainer_subscriptions s LEFT JOIN trainer_plans p ON p.id = s.plan_id
             WHERE s.trainer_id = :id AND s.expires_at IS NOT NULL AND COALESCE(p.is_free, 0) = 0 FOR UPDATE'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** A Y-m-d date, or null. */
    private static function date(mixed $value): ?string
    {
        if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)
            || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return null;
        }
        return $value;
    }

    /** A start date: null when not given, false when invalid or in the future. */
    private static function startDate(mixed $value): string|false|null
    {
        if ($value === null || $value === '') {
            return null;
        }
        $date = self::date($value);
        return $date === null || $date > date('Y-m-d') ? false : $date;
    }

    private static function kind(string $kind): ?string
    {
        if (!in_array($kind, self::KINDS, true)) {
            Response::error(404, 'not_found', 'Unknown account kind.');
            return null;
        }
        return $kind;
    }

    private static function ready(): bool
    {
        if (Limits::ready()) {
            return true;
        }
        Response::error(409, 'limits_unavailable', 'به‌روزرسانی دیتابیس «پلن‌ها و محدودیت مربی و باشگاه» هنوز اجرا نشده است.');
        return false;
    }

    private static function intOrNull(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : (int) $value;
    }
}
