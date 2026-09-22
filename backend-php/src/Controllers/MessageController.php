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

final class MessageController
{
    private const MAX_BODY = 1000;

    /**
     * Everyone the caller can message, newest conversation first — ports
     * list_message_threads (0036). Postgres built this with FILTER aggregates
     * and a LATERAL join for the last message; MySQL has neither, so the
     * counts use conditional SUM and the preview uses a window function.
     */
    public static function threads(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        // Counterparts come from three sources: an active coaching link, a
        // shared real plan, or an existing message either way.
        $stmt = $pdo->prepare(
            "SELECT DISTINCT counterpart_id, counterpart_role FROM (
                SELECT athlete_id AS counterpart_id, 'athlete' AS counterpart_role
                  FROM trainer_athletes WHERE trainer_id = :u1 AND status = 'active'
                UNION
                SELECT trainer_id, 'trainer'
                  FROM trainer_athletes WHERE athlete_id = :u2 AND status = 'active'
                UNION
                SELECT athlete_id, 'athlete' FROM workout_assignments
                  WHERE trainer_id = :u3 AND athlete_id IS NOT NULL AND is_template = 0 AND status <> 'draft'
                UNION
                SELECT trainer_id, 'trainer' FROM workout_assignments
                  WHERE athlete_id = :u4 AND is_template = 0 AND status <> 'draft'
                UNION
                SELECT athlete_id, 'athlete' FROM nutrition_assignments
                  WHERE trainer_id = :u5 AND athlete_id IS NOT NULL AND is_template = 0 AND status <> 'draft'
                UNION
                SELECT trainer_id, 'trainer' FROM nutrition_assignments
                  WHERE athlete_id = :u6 AND is_template = 0 AND status <> 'draft'
                UNION
                SELECT recipient_id, 'athlete' FROM messages WHERE sender_id = :u7
                UNION
                SELECT sender_id, 'athlete' FROM messages WHERE recipient_id = :u8
             ) AS counterparts
             WHERE counterpart_id <> :self"
        );
        $stmt->execute([
            'u1' => $user['id'], 'u2' => $user['id'], 'u3' => $user['id'], 'u4' => $user['id'],
            'u5' => $user['id'], 'u6' => $user['id'], 'u7' => $user['id'], 'u8' => $user['id'],
            'self' => $user['id'],
        ]);

        $roles = [];
        foreach ($stmt->fetchAll() as $row) {
            // A row that came only from the messages union defaults to
            // 'athlete'; a real coaching or plan link overrides it.
            $roles[$row['counterpart_id']] ??= $row['counterpart_role'];
            if ($row['counterpart_role'] === 'trainer') {
                $roles[$row['counterpart_id']] = 'trainer';
            }
        }

        if ($roles === []) {
            Response::ok(['items' => []]);
            return;
        }

        $ids = array_keys($roles);
        $profiles = self::profilesById($ids);
        $stats = self::messageStats($user['id'], $ids);
        $last = self::lastMessages($user['id'], $ids);
        $planCounts = self::sharedPlanCounts($user['id'], $ids);

        $threads = [];
        foreach ($roles as $counterpartId => $role) {
            $profile = $profiles[$counterpartId] ?? [];
            $threads[] = [
                'counterpart_id'         => $counterpartId,
                'counterpart_role'       => $role,
                'first_name'             => $profile['first_name'] ?? null,
                'last_name'              => $profile['last_name'] ?? null,
                'avatar_url'             => $profile['avatar_url'] ?? null,
                'plan_count'             => $planCounts[$counterpartId] ?? 0,
                'message_count'          => (int) ($stats[$counterpartId]['message_count'] ?? 0),
                'unread_count'           => (int) ($stats[$counterpartId]['unread_count'] ?? 0),
                'last_message_body'      => $last[$counterpartId]['body'] ?? null,
                'last_message_author_id' => $last[$counterpartId]['sender_id'] ?? null,
                'last_message_at'        => $last[$counterpartId]['created_at'] ?? null,
            ];
        }

        usort($threads, static function (array $a, array $b) {
            return strcmp($b['last_message_at'] ?? '', $a['last_message_at'] ?? '');
        });

        Response::ok(['items' => $threads]);
    }

    /** The whole back-and-forth with one person, plus the plans they share. */
    public static function conversation(array $params): void
    {
        $user = Auth::requireUser();
        $counterpartId = $params['id'];
        Acl::require(Acl::canMessage($user['id'], $counterpartId), 'You cannot message this person.');

        $pdo = Database::connection();
        $plans = [];

        foreach (['workout', 'nutrition'] as $kind) {
            $table = Acl::planTable($kind);
            $stmt = $pdo->prepare(
                "SELECT id, title, assigned_at FROM {$table}
                 WHERE is_template = 0 AND status <> 'draft'
                   AND ((trainer_id = :a AND athlete_id = :b) OR (trainer_id = :b2 AND athlete_id = :a2))
                 ORDER BY assigned_at DESC"
            );
            $stmt->execute(['a' => $user['id'], 'b' => $counterpartId, 'a2' => $user['id'], 'b2' => $counterpartId]);
            foreach ($stmt->fetchAll() as $plan) {
                $plans[] = $plan + ['kind' => $kind];
            }
        }
        usort($plans, static fn (array $a, array $b) => strcmp($b['assigned_at'], $a['assigned_at']));

        $stmt = $pdo->prepare(
            'SELECT m.id, m.sender_id, m.body, m.created_at, m.plan_kind, m.plan_id, m.read_at,
                    p.first_name, p.last_name, p.avatar_url
             FROM messages m
             JOIN profiles p ON p.id = m.sender_id
             WHERE (m.sender_id = :a AND m.recipient_id = :b)
                OR (m.sender_id = :b2 AND m.recipient_id = :a2)
             ORDER BY m.created_at ASC'
        );
        $stmt->execute(['a' => $user['id'], 'b' => $counterpartId, 'a2' => $user['id'], 'b2' => $counterpartId]);

        // plan_id has no single FK — workout and nutrition plans live in
        // separate tables — so a title is resolved by kind and id together.
        $titles = [];
        foreach ($plans as $plan) {
            $titles[$plan['kind'] . ':' . $plan['id']] = $plan['title'];
        }

        $messages = [];
        foreach ($stmt->fetchAll() as $row) {
            $row['plan_title'] = $row['plan_id'] !== null && $row['plan_kind'] !== null
                ? ($titles[$row['plan_kind'] . ':' . $row['plan_id']] ?? 'برنامه')
                : null;
            $messages[] = $row;
        }

        Response::ok(['plans' => $plans, 'messages' => $messages]);
    }

    /**
     * The thread attached to one plan: a filtered view of the same messages
     * table the inbox reads (0036).
     */
    public static function planComments(array $params): void
    {
        $user = Auth::requireUser();
        $plan = self::planOr404($params['kind'], $params['id']);
        Acl::require(Acl::canViewPlan($user, $plan));

        $stmt = Database::connection()->prepare(
            'SELECT m.id, m.sender_id, m.body, m.created_at,
                    p.first_name, p.last_name, p.avatar_url
             FROM messages m
             JOIN profiles p ON p.id = m.sender_id
             WHERE m.plan_kind = :kind AND m.plan_id = :plan_id
             ORDER BY m.created_at ASC'
        );
        $stmt->execute(['kind' => $params['kind'], 'plan_id' => $params['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    /**
     * Writing here is writing a message that happens to be about a plan. The
     * recipient isn't sent by the client: it is whichever side of the plan
     * isn't the person writing.
     */
    public static function addPlanComment(array $params): void
    {
        $user = Auth::requireUser();
        $kind = $params['kind'];
        $plan = self::planOr404($kind, $params['id']);
        $data = Validate::required(Validate::body(), ['body']);

        if ($plan['athlete_id'] === null) {
            Response::error(409, 'plan_unassigned', 'This plan has no athlete yet.');
            return;
        }

        $recipientId = $plan['trainer_id'] === $user['id'] ? $plan['athlete_id'] : $plan['trainer_id'];
        if ($recipientId === $user['id']) {
            Response::error(400, 'invalid_recipient', 'You cannot message yourself.');
            return;
        }
        Acl::require(Acl::canMessage($user['id'], $recipientId), 'You cannot message this person.');

        self::insertMessage($user, $recipientId, (string) $data['body'], $kind, $params['id']);
    }

    private static function planOr404(string $kind, string $id): array
    {
        if (!in_array($kind, ['workout', 'nutrition'], true)) {
            Response::error(404, 'not_found', 'Unknown plan kind.');
            exit;
        }

        $stmt = Database::connection()->prepare(
            'SELECT * FROM ' . Acl::planTable($kind) . ' WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $plan = $stmt->fetch();

        if ($plan === false) {
            Response::error(404, 'not_found', 'Plan not found.');
            exit;
        }

        return $plan;
    }

    public static function send(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['recipient_id', 'body']);

        $recipientId = (string) $data['recipient_id'];
        $body = trim((string) $data['body']);

        if ($body === '' || mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'A message must be between 1 and 1000 characters.');
            return;
        }
        Acl::require(Acl::canMessage($user['id'], $recipientId), 'You cannot message this person.');

        $planKind = Validate::nullableString($data['plan_kind'] ?? null);
        $planId = Validate::nullableString($data['plan_id'] ?? null);

        if (($planKind === null) !== ($planId === null)) {
            Response::error(400, 'invalid_plan', 'Pass both plan_kind and plan_id, or neither.');
            return;
        }
        if ($planId !== null) {
            Acl::require(
                Acl::planBelongsToPair($planKind, $planId, $user['id'], $recipientId),
                'That plan does not belong to this conversation.'
            );
        }

        self::insertMessage($user, $recipientId, $body, $planKind, $planId);
    }

    /** Shared by the direct composer and the per-plan thread. */
    private static function insertMessage(
        array $user,
        string $recipientId,
        string $rawBody,
        ?string $planKind,
        ?string $planId
    ): void {
        $body = trim($rawBody);
        if ($body === '' || mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'A message must be between 1 and 1000 characters.');
            return;
        }

        $pdo = Database::connection();
        $id = Uuid::v4();

        $pdo->prepare(
            'INSERT INTO messages (id, sender_id, recipient_id, body, plan_kind, plan_id)
             VALUES (:id, :sender_id, :recipient_id, :body, :plan_kind, :plan_id)'
        )->execute([
            'id'           => $id,
            'sender_id'    => $user['id'],
            'recipient_id' => $recipientId,
            'body'         => $body,
            'plan_kind'    => $planKind,
            'plan_id'      => $planId,
        ]);

        // notify_message (0036).
        AuthController::notify(
            $pdo,
            $recipientId,
            $user['id'],
            'message',
            'پیام جدید',
            trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) . ': ' . mb_substr($body, 0, 80),
            '/messages/' . $user['id']
        );

        Response::ok(['id' => $id], 201);
    }

    /**
     * Marks what this person sent as read, and clears the notifications they
     * produced in the same breath so the bell stops announcing a conversation
     * the user is looking at. 'plan_comment' covers rows written before 0036.
     */
    public static function markRead(array $params): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $pdo->prepare(
            'UPDATE messages SET read_at = NOW()
             WHERE recipient_id = :user AND sender_id = :counterpart AND read_at IS NULL'
        )->execute(['user' => $user['id'], 'counterpart' => $params['id']]);

        $pdo->prepare(
            "UPDATE notifications SET read_at = NOW()
             WHERE recipient_id = :user AND actor_id = :counterpart
               AND type IN ('message', 'plan_comment') AND read_at IS NULL"
        )->execute(['user' => $user['id'], 'counterpart' => $params['id']]);

        Response::ok(['ok' => true]);
    }

    /**
     * The summaries below are four fixed queries rather than four per
     * counterpart: a trainer with fifty athletes would otherwise open the
     * message list with two hundred round trips.
     */
    private static function profilesById(array $ids): array
    {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT id, first_name, last_name, avatar_url FROM profiles WHERE id IN ({$in})"
        );
        $stmt->execute($ids);

        return array_column($stmt->fetchAll(), null, 'id');
    }

    private static function messageStats(string $userId, array $ids): array
    {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS counterpart_id,
                    COUNT(*) AS message_count,
                    SUM(CASE WHEN recipient_id = ? AND read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
             FROM messages
             WHERE (sender_id = ? AND recipient_id IN ({$in}))
                OR (recipient_id = ? AND sender_id IN ({$in}))
             GROUP BY counterpart_id"
        );
        $stmt->execute(array_merge([$userId, $userId, $userId], $ids, [$userId], $ids));

        return array_column($stmt->fetchAll(), null, 'counterpart_id');
    }

    /**
     * Joins each conversation to its newest row. A window function would say
     * this more directly, but MySQL 5.7 — still common on shared hosting —
     * has none.
     */
    private static function lastMessages(string $userId, array $ids): array
    {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $pair = "CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END";
        $scope = "((sender_id = ? AND recipient_id IN ({$in})) OR (recipient_id = ? AND sender_id IN ({$in})))";

        $stmt = Database::connection()->prepare(
            "SELECT {$pair} AS counterpart_id, m.body, m.sender_id, m.created_at
             FROM messages m
             JOIN (
                SELECT {$pair} AS counterpart_id, MAX(created_at) AS newest
                FROM messages WHERE {$scope}
                GROUP BY counterpart_id
             ) newest_per_pair
               ON newest_per_pair.counterpart_id = {$pair}
              AND newest_per_pair.newest = m.created_at
             WHERE {$scope}"
        );
        $stmt->execute(array_merge(
            [$userId],                                  // outer pair expression
            [$userId], [$userId], $ids, [$userId], $ids, // derived table: pair + scope
            [$userId],                                  // join pair expression
            [$userId], $ids, [$userId], $ids            // outer scope
        ));

        // Two messages can share a timestamp to the second; the first wins.
        $byCounterpart = [];
        foreach ($stmt->fetchAll() as $row) {
            $byCounterpart[$row['counterpart_id']] ??= $row;
        }

        return $byCounterpart;
    }

    private static function sharedPlanCounts(string $userId, array $ids): array
    {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $counts = [];

        foreach (['workout_assignments', 'nutrition_assignments'] as $table) {
            $stmt = Database::connection()->prepare(
                "SELECT CASE WHEN trainer_id = ? THEN athlete_id ELSE trainer_id END AS counterpart_id,
                        COUNT(*) AS c
                 FROM {$table}
                 WHERE is_template = 0 AND status <> 'draft'
                   AND ((trainer_id = ? AND athlete_id IN ({$in}))
                     OR (athlete_id = ? AND trainer_id IN ({$in})))
                 GROUP BY counterpart_id"
            );
            $stmt->execute(array_merge([$userId, $userId], $ids, [$userId], $ids));

            foreach ($stmt->fetchAll() as $row) {
                $counts[$row['counterpart_id']] = ($counts[$row['counterpart_id']] ?? 0) + (int) $row['c'];
            }
        }

        return $counts;
    }
}
