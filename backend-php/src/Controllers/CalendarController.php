<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Recurrence;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * The trainer's month calendar. Two kinds of rows share calendar_events:
 *  - manual: reminders and informal sessions the trainer types in;
 *  - auto:   one row per dated package session, written only by
 *            syncSessionEvent() and read-only through this API.
 *
 * Everything is Gregorian here; the frontend converts to Jalali for display.
 * A recurring row is stored once and expanded per request, inside from..to.
 */
final class CalendarController
{
    /** A month is at most 31 days; the cap only stops a runaway range. */
    private const MAX_RANGE_DAYS = 100;
    private const MAX_NOTES_LENGTH = 2000;
    /** How far ahead a reminder may fire: 10 min, 30 min, 1 h, 1 day. */
    private const REMINDER_MINUTES = [10, 30, 60, 1440];
    /** Event times are entered as wall-clock time in Iran, whatever timezone the host runs in. */
    private const TIMEZONE = 'Asia/Tehran';

    public static function list(): void
    {
        $user = Auth::requireUser();

        $from = self::parseDate($_GET['from'] ?? null);
        $to = self::parseDate($_GET['to'] ?? null);
        if ($from === null || $to === null) {
            Response::error(400, 'invalid_range', 'from and to must be YYYY-MM-DD dates.');
            return;
        }
        if ($to < $from || $from->diff($to)->days > self::MAX_RANGE_DAYS) {
            Response::error(400, 'invalid_range', 'to must not be before from, and the range is at most ' . self::MAX_RANGE_DAYS . ' days.');
            return;
        }

        $fromStr = $from->format('Y-m-d');
        $toStr = $to->format('Y-m-d');

        // Plain rows dated inside the range, and recurring rows whose run overlaps it.
        $stmt = Database::connection()->prepare(
            "SELECT ce.id, ce.title, ce.notes, ce.athlete_id, ce.event_date, ce.start_time, ce.remind_before_minutes,
                    ce.recurrence_rule, ce.recurrence_until, ce.source, ce.source_type, ce.source_id,
                    p.first_name AS athlete_first_name, p.last_name AS athlete_last_name
             FROM calendar_events ce
             LEFT JOIN profiles p ON p.id = ce.athlete_id
             WHERE ce.trainer_id = :trainer_id
               AND (
                 (ce.recurrence_rule IS NULL AND ce.event_date BETWEEN :from1 AND :to1)
                 OR (ce.recurrence_rule IS NOT NULL AND ce.event_date <= :to2
                     AND (ce.recurrence_until IS NULL OR ce.recurrence_until >= :from2))
               )"
        );
        $stmt->execute([
            'trainer_id' => $user['id'],
            'from1' => $fromStr, 'to1' => $toStr,
            'from2' => $fromStr, 'to2' => $toStr,
        ]);

        $items = [];
        foreach ($stmt->fetchAll() as $row) {
            foreach (self::occurrences($row, $from, $to) as $date) {
                $items[] = [
                    'id'                   => $row['id'],
                    'title'                => $row['title'],
                    'notes'                => $row['notes'],
                    'remind_before_minutes' => $row['remind_before_minutes'] === null ? null : (int) $row['remind_before_minutes'],
                    'athlete_id'           => $row['athlete_id'],
                    'athlete_first_name'   => $row['athlete_first_name'],
                    'athlete_last_name'    => $row['athlete_last_name'],
                    'date'                 => $date,
                    'event_date'           => $row['event_date'],
                    'start_time'           => self::shortTime($row['start_time']),
                    'recurrence_rule'      => $row['recurrence_rule'],
                    'recurrence_until'     => $row['recurrence_until'],
                    'is_recurring'         => $row['recurrence_rule'] !== null,
                    'source'               => $row['source'],
                    'source_type'          => $row['source_type'],
                    'source_id'            => $row['source_id'],
                ];
            }
        }

        usort($items, static fn (array $a, array $b): int =>
            [$a['date'], $a['start_time'] ?? '99:99', $a['title']] <=> [$b['date'], $b['start_time'] ?? '99:99', $b['title']]);

        Response::ok(['items' => $items]);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['title', 'event_date']);

        $fields = self::validated($data, $user['id'], null);
        if ($fields === null) {
            return;
        }

        $id = Uuid::v4();
        // source is never read from the request: anything created here is manual.
        Database::connection()->prepare(
            "INSERT INTO calendar_events
               (id, trainer_id, athlete_id, title, notes, event_date, start_time, remind_before_minutes, recurrence_rule, recurrence_until, source)
             VALUES
               (:id, :trainer_id, :athlete_id, :title, :notes, :event_date, :start_time, :remind_before_minutes, :recurrence_rule, :recurrence_until, 'manual')"
        )->execute(['id' => $id, 'trainer_id' => $user['id']] + $fields);

        Response::ok(['id' => $id], 201);
    }

    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $event = self::manualEventOr404($params['id'], $user['id']);
        if ($event === null) {
            return;
        }

        $data = Validate::body();
        $allowed = ['title', 'notes', 'athlete_id', 'event_date', 'start_time', 'remind_before_minutes', 'recurrence_rule', 'recurrence_until'];
        if (array_intersect($allowed, array_keys($data)) === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        // Fields not sent keep their stored value.
        $merged = array_merge([
            'title'            => $event['title'],
            'notes'            => $event['notes'],
            'athlete_id'       => $event['athlete_id'],
            'event_date'       => $event['event_date'],
            'start_time'       => self::shortTime($event['start_time']),
            'remind_before_minutes' => $event['remind_before_minutes'],
            'recurrence_rule'  => $event['recurrence_rule'],
            'recurrence_until' => $event['recurrence_until'],
        ], array_intersect_key($data, array_flip($allowed)));

        $fields = self::validated($merged, $user['id'], $event['athlete_id']);
        if ($fields === null) {
            return;
        }

        Database::connection()->prepare(
            'UPDATE calendar_events
             SET title = :title, notes = :notes, athlete_id = :athlete_id, event_date = :event_date, start_time = :start_time,
                 remind_before_minutes = :remind_before_minutes,
                 recurrence_rule = :recurrence_rule, recurrence_until = :recurrence_until,
                 last_reminded_on = NULL
             WHERE id = :id AND trainer_id = :trainer_id'
        )->execute(['id' => $event['id'], 'trainer_id' => $user['id']] + $fields);

        Response::ok(['ok' => true]);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();
        $event = self::manualEventOr404($params['id'], $user['id']);
        if ($event === null) {
            return;
        }

        Database::connection()->prepare('DELETE FROM calendar_events WHERE id = :id AND trainer_id = :trainer_id')
            ->execute(['id' => $event['id'], 'trainer_id' => $user['id']]);

        Response::ok(['ok' => true]);
    }

    /**
     * Keeps the calendar row of one package session in step with it. Called by
     * SessionPackageController::updateSession after the session row changes
     * (same connection, so inside its transaction): a session with a date that
     * hasn't been cancelled gets an auto event, created or updated in place;
     * one without a date, or cancelled, has none.
     */
    public static function syncSessionEvent(string $sessionId): void
    {
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT ps.scheduled_at, ps.status, sp.trainer_id, sp.athlete_id, sp.title
             FROM package_sessions ps
             JOIN session_packages sp ON sp.id = ps.package_id
             WHERE ps.id = :id'
        );
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if ($session === false || $session['scheduled_at'] === null || $session['status'] === 'canceled') {
            $pdo->prepare("DELETE FROM calendar_events WHERE source = 'auto' AND source_type = 'session' AND source_id = :id")
                ->execute(['id' => $sessionId]);
            return;
        }

        $at = new \DateTimeImmutable($session['scheduled_at']);
        $values = [
            'trainer_id' => $session['trainer_id'],
            'athlete_id' => $session['athlete_id'],
            'title'      => 'جلسه خصوصی: ' . $session['title'],
            'event_date' => $at->format('Y-m-d'),
            'start_time' => $at->format('H:i:s'),
        ];

        $update = $pdo->prepare(
            "UPDATE calendar_events
             SET trainer_id = :trainer_id, athlete_id = :athlete_id, title = :title, event_date = :event_date, start_time = :start_time
             WHERE source = 'auto' AND source_type = 'session' AND source_id = :source_id"
        );
        $update->execute($values + ['source_id' => $sessionId]);

        // rowCount() is 0 both for "no such row" and "row already identical", so look before inserting.
        $exists = $pdo->prepare("SELECT 1 FROM calendar_events WHERE source = 'auto' AND source_type = 'session' AND source_id = :id");
        $exists->execute(['id' => $sessionId]);
        if ($exists->fetch() !== false) {
            return;
        }

        $pdo->prepare(
            "INSERT INTO calendar_events (id, trainer_id, athlete_id, title, event_date, start_time, source, source_type, source_id)
             VALUES (:id, :trainer_id, :athlete_id, :title, :event_date, :start_time, 'auto', 'session', :source_id)"
        )->execute($values + ['id' => Uuid::v4(), 'source_id' => $sessionId]);
    }

    /**
     * Run by cron (cron/calendar-reminders.php): sends one in-panel notification
     * per occurrence whose reminder time has arrived and whose start has not.
     * Only manual events remind; each occurrence of a recurring event reminds
     * once, tracked by last_reminded_on. Returns how many were sent.
     */
    public static function sendDueReminders(?\DateTimeImmutable $now = null): int
    {
        $pdo = Database::connection();
        $now ??= new \DateTimeImmutable('now', new \DateTimeZone(self::TIMEZONE));
        $today = $now->setTime(0, 0);
        $windowEnd = $today->modify('+1 day'); // the longest reminder is one day ahead

        $stmt = $pdo->prepare(
            "SELECT id, trainer_id, athlete_id, title, notes, event_date, start_time, remind_before_minutes,
                    recurrence_rule, recurrence_until, last_reminded_on
             FROM calendar_events
             WHERE source = 'manual' AND remind_before_minutes IS NOT NULL AND start_time IS NOT NULL
               AND event_date <= :window_end
               AND ((recurrence_rule IS NULL AND event_date >= :today1)
                    OR (recurrence_rule IS NOT NULL AND (recurrence_until IS NULL OR recurrence_until >= :today2)))"
        );
        $stmt->execute([
            'window_end' => $windowEnd->format('Y-m-d'),
            'today1'     => $today->format('Y-m-d'),
            'today2'     => $today->format('Y-m-d'),
        ]);

        $claim = $pdo->prepare(
            'UPDATE calendar_events SET last_reminded_on = :d
             WHERE id = :id AND (last_reminded_on IS NULL OR last_reminded_on < :d2)'
        );

        $sent = 0;
        foreach ($stmt->fetchAll() as $row) {
            foreach (self::occurrences($row, $today, $windowEnd) as $date) {
                $start = new \DateTimeImmutable($date . ' ' . $row['start_time'], new \DateTimeZone(self::TIMEZONE));
                $remindAt = $start->modify('-' . (int) $row['remind_before_minutes'] . ' minutes');
                if ($now < $remindAt || $now >= $start) {
                    continue;
                }
                if ($row['last_reminded_on'] !== null && $date <= $row['last_reminded_on']) {
                    continue;
                }

                // Claim before sending so two overlapping cron runs can't both notify.
                $claim->execute(['d' => $date, 'id' => $row['id'], 'd2' => $date]);
                if ($claim->rowCount() === 0) {
                    continue;
                }

                $when = ($date === $today->format('Y-m-d') ? 'امروز' : 'فردا') . ' ساعت ' . substr($row['start_time'], 0, 5);
                $body = $when;
                if ($row['notes'] !== null && $row['notes'] !== '') {
                    $body .= "\n" . mb_substr($row['notes'], 0, 200);
                }

                $message = strtr($body, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
                AuthController::notify(
                    $pdo,
                    $row['trainer_id'],
                    null,
                    'calendar_reminder',
                    'یادآوری: ' . $row['title'],
                    $message,
                    '/calendar',
                    ['event_id' => $row['id'], 'date' => $date]
                );
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * The event, scoped to its trainer, if it may be edited by hand. Ends the
     * request with an error (and returns null) for a missing or auto event.
     */
    private static function manualEventOr404(string $id, string $trainerId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, trainer_id, athlete_id, title, notes, event_date, start_time, remind_before_minutes,
                    recurrence_rule, recurrence_until, source
             FROM calendar_events WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $event = $stmt->fetch();

        if ($event === false) {
            Response::error(404, 'not_found', 'Calendar event not found.');
            return null;
        }
        Acl::require($event['trainer_id'] === $trainerId, 'This event is not yours.');

        if ($event['source'] !== 'manual') {
            Response::error(
                409,
                'auto_event_readonly',
                'رویدادهای خودکار (جلسات خصوصی) را نمی‌توان دستی تغییر داد یا حذف کرد؛ زمان یا وضعیت خود جلسه را در پکیج ورزشکار تغییر دهید.'
            );
            return null;
        }

        return $event;
    }

    /**
     * Checks and normalises the writable fields, keyed for the INSERT/UPDATE
     * binds. Ends the request with 400/403 and returns null on bad input.
     * $currentAthleteId is the athlete already on the row, which stays allowed
     * even if the trainer has since dropped them.
     */
    private static function validated(array $data, string $trainerId, ?string $currentAthleteId): ?array
    {
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 255) {
            Response::error(400, 'invalid_title', 'title must be 1 to 255 characters.');
            return null;
        }

        $notes = trim((string) ($data['notes'] ?? ''));
        if (mb_strlen($notes) > self::MAX_NOTES_LENGTH) {
            Response::error(400, 'invalid_notes', 'notes must be at most ' . self::MAX_NOTES_LENGTH . ' characters.');
            return null;
        }

        $eventDate = self::parseDate($data['event_date'] ?? null);
        if ($eventDate === null) {
            Response::error(400, 'invalid_event_date', 'event_date must be a YYYY-MM-DD date.');
            return null;
        }

        $startTime = null;
        $rawTime = $data['start_time'] ?? null;
        if ($rawTime !== null && $rawTime !== '') {
            $time = \DateTimeImmutable::createFromFormat('!H:i', substr((string) $rawTime, 0, 5));
            if ($time === false || !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', (string) $rawTime)) {
                Response::error(400, 'invalid_start_time', 'start_time must be HH:MM.');
                return null;
            }
            $startTime = $time->format('H:i:s');
        }

        $remind = null;
        $rawRemind = $data['remind_before_minutes'] ?? null;
        if ($rawRemind !== null && $rawRemind !== '') {
            $remind = filter_var($rawRemind, FILTER_VALIDATE_INT);
            if ($remind === false || !in_array($remind, self::REMINDER_MINUTES, true)) {
                Response::error(400, 'invalid_remind_before_minutes', 'remind_before_minutes must be one of ' . implode(', ', self::REMINDER_MINUTES) . '.');
                return null;
            }
            if ($startTime === null) {
                Response::error(400, 'reminder_needs_time', 'A reminder needs start_time.');
                return null;
            }
        }

        $athleteId = Validate::nullableString(isset($data['athlete_id']) ? (string) $data['athlete_id'] : null);
        if ($athleteId !== null && $athleteId !== $currentAthleteId) {
            Acl::require(Acl::isTrainerOf($trainerId, $athleteId), 'This athlete is not on your roster.');
        }

        $rule = null;
        $until = null;
        $rawRule = $data['recurrence_rule'] ?? null;
        if ($rawRule !== null && $rawRule !== '') {
            $rule = Recurrence::normalize((string) $rawRule);
            if ($rule === null) {
                Response::error(400, 'invalid_recurrence_rule', 'recurrence_rule is not a valid repeat rule.');
                return null;
            }

            $rawUntil = $data['recurrence_until'] ?? null;
            if ($rawUntil !== null && $rawUntil !== '') {
                $untilDate = self::parseDate($rawUntil);
                if ($untilDate === null || $untilDate < $eventDate) {
                    Response::error(400, 'invalid_recurrence_until', 'recurrence_until must be a YYYY-MM-DD date on or after event_date.');
                    return null;
                }
                $until = $untilDate->format('Y-m-d');
            }
        }

        return [
            'athlete_id'       => $athleteId,
            'title'            => $title,
            'notes'            => $notes === '' ? null : $notes,
            'event_date'       => $eventDate->format('Y-m-d'),
            'start_time'       => $startTime,
            'remind_before_minutes' => $remind,
            'recurrence_rule'  => $rule,
            'recurrence_until' => $until,
        ];
    }

    /**
     * The Y-m-d dates a stored row lands on inside from..to: its own date for a
     * plain row, the dates its recurrence rule produces for a recurring one.
     *
     * @return string[]
     */
    private static function occurrences(array $row, \DateTimeImmutable $from, \DateTimeImmutable $to): array
    {
        $start = new \DateTimeImmutable($row['event_date']);

        if ($row['recurrence_rule'] === null) {
            return [$start->format('Y-m-d')];
        }

        $until = $row['recurrence_until'] === null ? null : new \DateTimeImmutable($row['recurrence_until']);
        return Recurrence::occurrences($row['recurrence_rule'], $start, $from, $to, $until);
    }

    private static function parseDate(mixed $value): ?\DateTimeImmutable
    {
        if (!is_string($value) || $value === '') {
            return null;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = \DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            return null;
        }
        return $date;
    }

    private static function shortTime(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}
