<?php
declare(strict_types=1);

// Notifies athletes whose trainer asked to be reminded to re-record their measurements
// and whose latest measurement is older than the chosen interval. Meant for the host's
// cron, once a day is enough:
//
//   php /home/USER/path/to/backend-php/cron/assessment-reminders.php
//
// Running it again inside the same interval notifies nobody twice
// (assessment_reminders.last_reminded_at).
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

$sent = Gymlic\Controllers\ProgressController::sendDueReminders();
echo date('Y-m-d H:i:s'), " assessment reminders sent: {$sent}\n";
