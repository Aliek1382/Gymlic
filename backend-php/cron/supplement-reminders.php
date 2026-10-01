<?php
declare(strict_types=1);

// Sends the supplement plans' due reminders as notifications (and pushes them).
//
// The host's existing 5-minute cron already runs this: cron/calendar-reminders.php
// calls the same code. This file exists to run it on its own, for testing or for
// a host that wants a separate cron entry:
//
//   php /home/USER/path/to/backend-php/cron/supplement-reminders.php
//
// Safe to run any number of times: a plan item is claimed for today before it is
// reminded, so a repeated or overlapping run sends nothing twice.
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

$sent = Gymlic\Controllers\SupplementController::sendDueReminders();
$pushed = Gymlic\Controllers\PushController::deliverPending();
echo date('Y-m-d H:i:s'), " supplement reminders sent: {$sent}, notifications pushed: {$pushed}\n";
