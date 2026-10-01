<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\Templates;

/**
 * A trainer's supplement plan for one athlete: a titled list of (supplement,
 * dose, time of day). The supplement library itself is LibraryController's
 * 'supplements' kind; this controller only owns the plans, and the reminders
 * that go out to the athlete as ordinary notifications.
 */
final class SupplementController
{
    /** Reminders are wall-clock times in Iran, whatever timezone the host runs in (same as the calendar). */
    private const TIMEZONE = 'Asia/Tehran';

    private const MAX_ITEMS = 30;

    /**
     * How long after its time an item may still be reminded. Covers a cron that
     * runs every 5 to 15 minutes; a longer-overdue item stays silent instead of
     * pinging at a random hour (a plan made at 14:00 for "breakfast" today).
     */
    private const GRACE_MINUTES = 30;

    private const STATUSES = ['active', 'completed', 'cancelled'];

    /**
     * Fixed reminder times. before_workout / after_workout have none on purpose:
     * they depend on the athlete's training schedule, which isn't structured
     * enough to read a time from, so they only remind when custom_time is set.
     */
    private const FIXED_TIMES = [
        'breakfast'    => '08:00',
        'lunch'        => '13:00',
        'dinner'       => '20:00',
        'before_sleep' => '22:30',
    ];

    private const TIMINGS = ['before_workout', 'after_workout', 'breakfast', 'lunch', 'dinner', 'before_sleep', 'custom'];

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['athlete_id', 'title', 'items']);

        $athleteId = (string) $data['athlete_id'];
        Acl::require(Acl::isTrainerOf($user['id'], $athleteId), 'This athlete is not on your roster.');

        $title = self::title($data['title']);
        $items = self::items($data['items'], $user['id']);
        if ($title === null || $items === null) {
            return;
        }

        $pdo = Database::connection();
        $id = Uuid::v4();

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO supplement_assignments (id, trainer_id, athlete_id, title)
                 VALUES (:id, :trainer_id, :athlete_id, :title)'
            )->execute(['id' => $id, 'trainer_id' => $user['id'], 'athlete_id' => $athleteId, 'title' => $title]);

            self::insertItems($id, $items, []);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Templates::notify(
            $pdo,
            'supplement_assigned',
            $athleteId,
            $user['id'],
            'supplement_assigned',
            ['title' => $title],
            '/nutrition',
            ['assignment_id' => $id]
        );

        Response::ok(['id' => $id], 201);
    }

    /** A trainer's supplement plans for one athlete. */
    public static function list(): void
    {
        $user = Auth::requireUser();
        $athleteId = Validate::nullableString($_GET['athlete_id'] ?? null);
        if ($athleteId === null) {
            Response::error(400, 'missing_fields', 'Missing required field(s): athlete_id');
            return;
        }

        $stmt = Database::connection()->prepare(
            self::listSql() . ' WHERE sa.trainer_id = :trainer_id AND sa.athlete_id = :athlete_id
                                ORDER BY sa.created_at DESC'
        );
        $stmt->execute(['trainer_id' => $user['id'], 'athlete_id' => $athleteId]);

        Response::ok(['items' => self::withItems($stmt->fetchAll())]);
    }

    /** The athlete's own plans; a cancelled one is gone from their side. */
    public static function listMine(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            self::listSql() . " WHERE sa.athlete_id = :athlete_id AND sa.status <> 'cancelled'
                                ORDER BY sa.status = 'active' DESC, sa.created_at DESC"
        );
        $stmt->execute(['athlete_id' => $user['id']]);

        Response::ok(['items' => self::withItems($stmt->fetchAll())]);
    }

    /** title, status and/or items; items, when present, replace the whole list. */
    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id'], 'Only the plan\'s trainer can change it.');

        $data = Validate::body();
        $hasTitle = array_key_exists('title', $data);
        $hasStatus = array_key_exists('status', $data);
        $hasItems = array_key_exists('items', $data);
        if (!$hasTitle && !$hasStatus && !$hasItems) {
            Response::error(400, 'missing_fields', 'Pass title, status and/or items.');
            return;
        }

        $title = $assignment['title'];
        if ($hasTitle) {
            $title = self::title($data['title']);
            if ($title === null) {
                return;
            }
        }

        $status = $assignment['status'];
        if ($hasStatus) {
            $status = (string) $data['status'];
            if (!in_array($status, self::STATUSES, true)) {
                Response::error(400, 'invalid_status', 'status must be active, completed or cancelled.');
                return;
            }
        }

        $items = null;
        if ($hasItems) {
            $items = self::items($data['items'], $user['id']);
            if ($items === null) {
                return;
            }
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE supplement_assignments SET title = :title, status = :status WHERE id = :id')
                ->execute(['title' => $title, 'status' => $status, 'id' => $assignment['id']]);

            if ($items !== null) {
                // An unchanged item keeps its last_reminded_on, so saving the plan
                // minutes after a reminder went out doesn't send the same one again.
                $old = $pdo->prepare(
                    'SELECT supplement_id, timing, custom_time, last_reminded_on FROM supplement_plan_items WHERE assignment_id = :id'
                );
                $old->execute(['id' => $assignment['id']]);
                $reminded = [];
                foreach ($old->fetchAll() as $row) {
                    if ($row['last_reminded_on'] !== null) {
                        $reminded[self::itemKey($row['supplement_id'], $row['timing'], $row['custom_time'])] = $row['last_reminded_on'];
                    }
                }

                $pdo->prepare('DELETE FROM supplement_plan_items WHERE assignment_id = :id')
                    ->execute(['id' => $assignment['id']]);
                self::insertItems($assignment['id'], $items, $reminded);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['ok' => true]);
    }

    public static function delete(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id'], 'Only the plan\'s trainer can delete it.');

        // supplement_plan_items go with it (ON DELETE CASCADE).
        Database::connection()->prepare('DELETE FROM supplement_assignments WHERE id = :id')
            ->execute(['id' => $assignment['id']]);

        Response::ok(['ok' => true]);
    }

    /**
     * Sends a notification for every plan item whose time has come today. Run
     * by the host's cron (cron/supplement-reminders.php, and calendar-reminders.php
     * calls it too). Idempotent: each item is claimed for today before anything
     * is sent, so a repeated or overlapping run sends nothing twice.
     * Returns how many notifications were sent.
     */
    public static function sendDueReminders(?\DateTimeImmutable $now = null): int
    {
        $pdo = Database::connection();
        $now ??= new \DateTimeImmutable('now', new \DateTimeZone(self::TIMEZONE));
        $today = $now->format('Y-m-d');

        $stmt = $pdo->prepare(
            "SELECT spi.id, spi.timing, spi.custom_time, spi.dose, spi.note, spi.last_reminded_on,
                    sa.id AS assignment_id, sa.trainer_id, sa.athlete_id, s.name AS supplement_name
             FROM supplement_plan_items spi
             JOIN supplement_assignments sa ON sa.id = spi.assignment_id
             JOIN supplements s ON s.id = spi.supplement_id
             WHERE sa.status = 'active'
               AND (spi.last_reminded_on IS NULL OR spi.last_reminded_on < :today)
             ORDER BY spi.sort_order"
        );
        $stmt->execute(['today' => $today]);

        $claim = $pdo->prepare(
            'UPDATE supplement_plan_items SET last_reminded_on = :today
             WHERE id = :id AND (last_reminded_on IS NULL OR last_reminded_on < :today2)'
        );

        // One notification per athlete, plan and time, however many supplements share it.
        $groups = [];
        foreach ($stmt->fetchAll() as $row) {
            $time = self::reminderTime($row['timing'], $row['custom_time']);
            if ($time === null) {
                continue;
            }

            $dueAt = new \DateTimeImmutable($today . ' ' . $time, new \DateTimeZone(self::TIMEZONE));
            if ($now < $dueAt || $now >= $dueAt->modify('+' . self::GRACE_MINUTES . ' minutes')) {
                continue;
            }

            // Claim before sending so two overlapping cron runs can't both notify.
            $claim->execute(['today' => $today, 'id' => $row['id'], 'today2' => $today]);
            if ($claim->rowCount() === 0) {
                continue;
            }

            $groups[$row['assignment_id'] . '|' . $time][] = ['time' => $time, 'row' => $row];
        }

        foreach ($groups as $entries) {
            $first = $entries[0]['row'];
            $lines = array_map(
                static fn (array $e): string => '• ' . $e['row']['supplement_name'] . ' — ' . $e['row']['dose']
                    . ($e['row']['note'] !== null && $e['row']['note'] !== '' ? ' (' . $e['row']['note'] . ')' : ''),
                $entries
            );

            Templates::notify(
                $pdo,
                'supplement_reminder',
                $first['athlete_id'],
                $first['trainer_id'],
                'supplement_reminder',
                ['details' => self::persianDigits(implode("\n", $lines))],
                '/nutrition',
                [
                    'assignment_id' => $first['assignment_id'],
                    'item_ids'      => array_map(static fn (array $e): string => $e['row']['id'], $entries),
                    'date'          => $today,
                    'time'          => $entries[0]['time'],
                ]
            );
        }

        return count($groups);
    }

    /** 'H:i' a plan item reminds at, or null when it has no usable time (see FIXED_TIMES). */
    private static function reminderTime(string $timing, ?string $customTime): ?string
    {
        if ($customTime !== null && ($timing === 'custom' || $timing === 'before_workout' || $timing === 'after_workout')) {
            return substr($customTime, 0, 5);
        }
        return self::FIXED_TIMES[$timing] ?? null;
    }

    private static function title(mixed $value): ?string
    {
        $title = is_string($value) ? trim($value) : '';
        if ($title === '' || mb_strlen($title) > 255) {
            Response::error(400, 'invalid_title', 'title must be 1 to 255 characters.');
            return null;
        }
        return $title;
    }

    /**
     * Validated items, in order, or null after answering 400. Every supplement
     * must be in the trainer's own library view (shared or theirs).
     *
     * @return array<int, array{supplement_id: string, dose: string, timing: string, custom_time: ?string, note: ?string}>|null
     */
    private static function items(mixed $raw, string $trainerId): ?array
    {
        if (!is_array($raw) || !array_is_list($raw) || count($raw) < 1 || count($raw) > self::MAX_ITEMS) {
            Response::error(400, 'invalid_items', 'items must be a list of 1 to ' . self::MAX_ITEMS . ' entries.');
            return null;
        }

        $visible = Database::connection()->prepare(
            'SELECT 1 FROM supplements WHERE id = :id AND (created_by IS NULL OR created_by = :trainer_id)'
        );

        $items = [];
        foreach ($raw as $index => $item) {
            $n = $index + 1;
            if (!is_array($item)) {
                Response::error(400, 'invalid_items', "Item {$n} must be an object.");
                return null;
            }

            $supplementId = (string) ($item['supplement_id'] ?? '');
            $visible->execute(['id' => $supplementId, 'trainer_id' => $trainerId]);
            if ($supplementId === '' || $visible->fetch() === false) {
                Response::error(400, 'invalid_supplement', "Item {$n}: unknown supplement.");
                return null;
            }

            $dose = trim((string) ($item['dose'] ?? ''));
            if ($dose === '' || mb_strlen($dose) > 100) {
                Response::error(400, 'invalid_dose', "Item {$n}: dose must be 1 to 100 characters.");
                return null;
            }

            $timing = (string) ($item['timing'] ?? '');
            if (!in_array($timing, self::TIMINGS, true)) {
                Response::error(400, 'invalid_timing', "Item {$n}: unknown timing.");
                return null;
            }

            $customTime = null;
            $rawTime = $item['custom_time'] ?? null;
            if ($rawTime !== null && $rawTime !== '') {
                if (!is_string($rawTime) || preg_match('/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/', $rawTime) !== 1) {
                    Response::error(400, 'invalid_time', "Item {$n}: custom_time must be HH:MM.");
                    return null;
                }
                $customTime = substr($rawTime, 0, 5) . ':00';
            }
            // Only custom/before/after_workout read a time; for the fixed meals it would be misleading noise.
            if ($timing === 'custom' && $customTime === null) {
                Response::error(400, 'invalid_time', "Item {$n}: custom timing needs custom_time.");
                return null;
            }
            if (isset(self::FIXED_TIMES[$timing])) {
                $customTime = null;
            }

            $note = Validate::nullableString(isset($item['note']) ? trim((string) $item['note']) : null);
            if ($note !== null && mb_strlen($note) > 255) {
                Response::error(400, 'invalid_note', "Item {$n}: note must be at most 255 characters.");
                return null;
            }

            $items[] = [
                'supplement_id' => $supplementId,
                'dose'          => $dose,
                'timing'        => $timing,
                'custom_time'   => $customTime,
                'note'          => $note,
            ];
        }

        return $items;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @param array<string, string> $reminded itemKey() => last_reminded_on carried over from the replaced items
     */
    private static function insertItems(string $assignmentId, array $items, array $reminded): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO supplement_plan_items
                (id, assignment_id, supplement_id, dose, timing, custom_time, note, sort_order, last_reminded_on)
             VALUES (:id, :assignment_id, :supplement_id, :dose, :timing, :custom_time, :note, :sort_order, :last_reminded_on)'
        );

        foreach ($items as $order => $item) {
            $stmt->execute([
                'id'               => Uuid::v4(),
                'assignment_id'    => $assignmentId,
                'supplement_id'    => $item['supplement_id'],
                'dose'             => $item['dose'],
                'timing'           => $item['timing'],
                'custom_time'      => $item['custom_time'],
                'note'             => $item['note'],
                'sort_order'       => $order,
                'last_reminded_on' => $reminded[self::itemKey($item['supplement_id'], $item['timing'], $item['custom_time'])] ?? null,
            ]);
        }
    }

    private static function itemKey(string $supplementId, string $timing, ?string $customTime): string
    {
        return $supplementId . '|' . $timing . '|' . ($customTime === null ? '' : substr($customTime, 0, 5));
    }

    private static function listSql(): string
    {
        return 'SELECT sa.id, sa.trainer_id, sa.athlete_id, sa.title, sa.status, sa.created_at, sa.updated_at,
                       tp.first_name AS trainer_first_name, tp.last_name AS trainer_last_name
                FROM supplement_assignments sa
                JOIN profiles tp ON tp.id = sa.trainer_id';
    }

    /** @param array<int, array<string, mixed>> $rows */
    private static function withItems(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_column($rows, 'id');
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT spi.id, spi.assignment_id, spi.supplement_id, spi.dose, spi.timing, spi.custom_time, spi.note, spi.sort_order,
                    s.name AS supplement_name, s.name_en AS supplement_name_en
             FROM supplement_plan_items spi
             JOIN supplements s ON s.id = spi.supplement_id
             WHERE spi.assignment_id IN ({$marks})
             ORDER BY spi.sort_order"
        );
        $stmt->execute($ids);

        $byAssignment = [];
        foreach ($stmt->fetchAll() as $item) {
            $item['sort_order'] = (int) $item['sort_order'];
            $item['custom_time'] = $item['custom_time'] === null ? null : substr($item['custom_time'], 0, 5);
            $byAssignment[$item['assignment_id']][] = $item;
        }

        foreach ($rows as &$row) {
            $row['items'] = $byAssignment[$row['id']] ?? [];
        }
        return $rows;
    }

    private static function assignmentOr404(string $id): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, trainer_id, athlete_id, title, status FROM supplement_assignments WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error(404, 'not_found', 'Supplement plan not found.');
            exit;
        }
        return $row;
    }

    private static function persianDigits(string $text): string
    {
        return strtr($text, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
