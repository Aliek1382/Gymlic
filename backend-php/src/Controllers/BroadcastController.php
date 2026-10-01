<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use Gymlic\Auth;
use Gymlic\Broadcasts;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Throwable;

/** /admin/broadcasts: the notifications page's "send to a group". Needs the notifications permission. */
final class BroadcastController
{
    /** The admin picks the send time as wall-clock time in Iran, like the calendar. */
    private const TIMEZONE = 'Asia/Tehran';
    private const MAX_TITLE = 255;
    private const MAX_BODY = 2000;

    public static function list(): void
    {
        Auth::requireAdmin('notifications');
        if (!Broadcasts::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }

        $rows = Database::connection()->query(
            "SELECT b.id, b.title, b.body, b.link, b.audience, b.channels, b.status, b.scheduled_at, b.sent_at,
                    b.recipient_count, b.sms_count, b.email_count, b.error, b.created_at,
                    CONCAT_WS(' ', p.first_name, p.last_name) AS created_by_name
             FROM broadcasts b
             LEFT JOIN profiles p ON p.id = b.created_by
             ORDER BY COALESCE(b.scheduled_at, b.created_at) DESC
             LIMIT 100"
        )->fetchAll();

        foreach ($rows as &$row) {
            $row['audience'] = Broadcasts::normalizeAudience(json_decode((string) $row['audience'], true));
            $row['channels'] = Broadcasts::normalizeChannels(json_decode((string) $row['channels'], true));
            $row['scheduled_at'] = self::toIso($row['scheduled_at']);
            foreach (['recipient_count', 'sms_count', 'email_count'] as $key) {
                $row[$key] = (int) $row[$key];
            }
        }
        unset($row);

        Response::ok(['ready' => true, 'items' => $rows]);
    }

    /** How many people the audience reaches, before sending. */
    public static function preview(): void
    {
        Auth::requireAdmin('notifications');
        $data = Validate::body();
        Response::ok(Broadcasts::preview(
            Database::connection(),
            Broadcasts::normalizeAudience($data['audience'] ?? null),
            Broadcasts::normalizeChannels($data['channels'] ?? null)
        ));
    }

    public static function create(): void
    {
        $admin = Auth::requireAdmin('notifications');
        $data = Validate::body();
        $pdo = Database::connection();

        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > self::MAX_TITLE) {
            Response::error(400, 'invalid_title', 'عنوان اعلان را وارد کنید (حداکثر ۲۵۵ نویسه).');
            return;
        }
        $body = Validate::nullableString(trim((string) ($data['body'] ?? '')));
        if ($body !== null && mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'متن اعلان حداکثر ۲۰۰۰ نویسه است.');
            return;
        }
        $link = Validate::nullableString(trim((string) ($data['link'] ?? '')));
        if ($link !== null && (mb_strlen($link) > 500 || !preg_match('#^(/|https?://)#', $link))) {
            Response::error(400, 'invalid_link', 'لینک باید با / (صفحه‌ای از سایت) یا https:// شروع شود.');
            return;
        }

        $audience = Broadcasts::normalizeAudience($data['audience'] ?? null);
        $channels = Broadcasts::normalizeChannels($data['channels'] ?? null);

        $scheduledAt = null;
        if (!empty($data['scheduled_at'])) {
            $scheduledAt = self::parseTehran((string) $data['scheduled_at']);
            if ($scheduledAt === null) {
                Response::error(400, 'invalid_schedule', 'زمان ارسال معتبر نیست.');
                return;
            }
            if ($scheduledAt->getTimestamp() < time() + 60) {
                Response::error(400, 'invalid_schedule', 'زمان ارسال باید دست‌کم یک دقیقه بعد باشد؛ برای ارسال فوری زمان را خالی بگذارید.');
                return;
            }
            if (!Broadcasts::ready()) {
                Response::error(409, 'broadcasts_not_ready', 'ارسال زمان‌بندی‌شده هنوز فعال نیست. به‌روزرسانی «اعلان همگانی، تیکت پشتیبانی و صفحه‌های متنی (فاز ۷)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
                return;
            }
        }

        $preview = Broadcasts::preview($pdo, $audience, $channels);
        if ($preview['recipients'] === 0) {
            Response::error(400, 'no_recipients', 'با این انتخاب هیچ گیرنده‌ای پیدا نشد.');
            return;
        }

        $log = ['title' => $title, 'audience' => $audience, 'channels' => $channels];

        // Before the SQL: sent right away, with no history row (as before).
        if (!Broadcasts::ready()) {
            $counts = Broadcasts::deliver($pdo, [
                'id' => null, 'title' => $title, 'body' => $body, 'link' => $link,
                'audience' => $audience, 'channels' => $channels, 'created_by' => $admin['id'],
            ]);
            AdminController::logActivity($pdo, null, $admin['id'], null, 'broadcast_sent', $log + $counts);
            Response::ok(['status' => 'sent'] + $counts);
            return;
        }

        $id = Uuid::v4();
        $row = [
            'id'           => $id,
            'title'        => $title,
            'body'         => $body,
            'link'         => $link,
            'audience'     => json_encode($audience, JSON_UNESCAPED_UNICODE),
            'channels'     => json_encode($channels),
            'status'       => $scheduledAt !== null ? 'scheduled' : 'sending',
            // Stored in the PHP clock the dispatch cron compares against.
            'scheduled_at' => $scheduledAt?->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('Y-m-d H:i:s'),
            'created_by'   => $admin['id'],
        ];
        $pdo->prepare(
            'INSERT INTO broadcasts (' . implode(', ', array_keys($row)) . ') VALUES (:' . implode(', :', array_keys($row)) . ')'
        )->execute($row);

        if ($scheduledAt !== null) {
            AdminController::logActivity($pdo, null, $admin['id'], null, 'broadcast_scheduled', $log + [
                'scheduled_at' => $scheduledAt->format('Y-m-d H:i'),
                'recipients'   => $preview['recipients'],
            ]);
            Response::ok(['status' => 'scheduled', 'id' => $id] + $preview, 201);
            return;
        }

        try {
            $counts = Broadcasts::sendRow($pdo, $row);
        } catch (Throwable $e) {
            Response::error(500, 'broadcast_failed', 'ارسال اعلان کامل نشد؛ جزئیات در تاریخچهٔ ارسال‌ها ثبت شد.');
            return;
        }
        AdminController::logActivity($pdo, null, $admin['id'], null, 'broadcast_sent', $log + $counts);
        Response::ok(['status' => 'sent', 'id' => $id] + $counts, 201);
    }

    public static function cancel(array $params): void
    {
        $admin = Auth::requireAdmin('notifications');
        if (!Broadcasts::ready()) {
            Response::error(404, 'not_found', 'Not found.');
            return;
        }
        $pdo = Database::connection();
        $stmt = $pdo->prepare("UPDATE broadcasts SET status = 'cancelled' WHERE id = :id AND status = 'scheduled'");
        $stmt->execute(['id' => $params['id']]);
        if ($stmt->rowCount() === 0) {
            Response::error(409, 'not_scheduled', 'این اعلان دیگر در انتظار ارسال نیست.');
            return;
        }
        AdminController::logActivity($pdo, null, $admin['id'], null, 'broadcast_cancelled', ['id' => $params['id']]);
        Response::ok(['ok' => true]);
    }

    /** "2026-10-05T18:30" (Iran wall-clock) -> an instant, or null. */
    private static function parseTehran(string $value): ?DateTimeImmutable
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/', $value)) {
            return null;
        }
        $parsed = DateTimeImmutable::createFromFormat('Y-m-d H:i', str_replace('T', ' ', $value), new DateTimeZone(self::TIMEZONE));
        return $parsed === false ? null : $parsed;
    }

    /** A stored scheduled_at (PHP's clock) as ISO 8601 with its offset, so the browser shows it right. */
    private static function toIso(?string $stored): ?string
    {
        if ($stored === null) {
            return null;
        }
        return (new DateTimeImmutable($stored, new DateTimeZone(date_default_timezone_get())))->format(DATE_ATOM);
    }
}
