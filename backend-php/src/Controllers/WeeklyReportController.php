<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\WeeklyReport;

/**
 * The weekly email report's admin side (settings permission): its settings,
 * a preview of what next Saturday's email would say right now, and "send
 * now". The settings themselves are saved as the "reports" settings group.
 */
final class WeeklyReportController
{
    public static function get(): void
    {
        Auth::requireAdmin('settings');
        $pdo = Database::connection();
        $report = WeeklyReport::build($pdo);
        Response::ok([
            'settings'      => Settings::get('reports'),
            'storage_ready' => Settings::storageReady(),
            'last_sent'     => WeeklyReport::lastSent($pdo),
            'subject'       => $report['subject'],
            'preview'       => $report['text'],
        ]);
    }

    /** Sends it now to the saved recipients. */
    public static function sendNow(): void
    {
        $admin = Auth::requireAdmin('settings');
        $recipients = Settings::get('reports')['recipients'];
        if ($recipients === []) {
            Response::error(400, 'no_recipients', 'اول دست‌کم یک ایمیل گیرنده ذخیره کنید.');
            return;
        }
        $pdo = Database::connection();
        $result = WeeklyReport::send($pdo, $recipients);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'weekly_report_sent', ['sent' => $result['sent']]);
        if ($result['sent'] === 0) {
            Response::error(502, 'mail_failed', 'ارسال ایمیل ناموفق بود: ' . ($result['failed'][0]['error'] ?? ''));
            return;
        }
        Response::ok($result);
    }
}
