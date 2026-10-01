<?php
declare(strict_types=1);

// Sends the calendar's due reminders as notifications, and pushes pending notifications to devices. Meant for the
// host's cron, every 5 minutes:
//
//   php /home/USER/path/to/backend-php/cron/calendar-reminders.php
//
// Command line only: this file must never do anything when reached over HTTP.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Gymlic\\')) {
        return;
    }
    $path = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen('Gymlic\\'))) . '.php';
    if (is_file($path)) {
        require_once $path;
    }
});

// Warnings and crashes also show up in the admin's error log.
Gymlic\ErrorLog::registerCli();

$sent = Gymlic\Controllers\CalendarController::sendDueReminders();
// Supplement-plan reminders ride the same cron. Guarded so that a host whose
// supplement tables don't exist yet (backend deployed before the SQL ran) still
// sends calendar reminders and pushes.
try {
    $supplements = Gymlic\Controllers\SupplementController::sendDueReminders();
} catch (Throwable $e) {
    $supplements = 0;
    fwrite(STDERR, 'supplement reminders failed: ' . $e->getMessage() . "\n");
}
// Every notification is also pushed to phones and desktops; this sweep delivers
// the ones nothing pushed at creation time (admin broadcasts, or a push that never ran).
$pushed = Gymlic\Controllers\PushController::deliverPending();
$summary = "reminders sent: {$sent}, supplement reminders: {$supplements}, notifications pushed: {$pushed}";
Gymlic\CronHeartbeat::record('calendar-reminders', $summary);
echo date('Y-m-d H:i:s'), " {$summary}\n";
