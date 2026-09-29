<?php
declare(strict_types=1);

// Sends the calendar's due reminders as in-panel notifications. Meant for the
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

$sent = Gymlic\Controllers\CalendarController::sendDueReminders();
echo date('Y-m-d H:i:s'), " reminders sent: {$sent}\n";
