<?php
declare(strict_types=1);

// Tells whoever has to answer a card-to-card payment that it has been waiting
// (finance admins, club owners, trainers): one message per person, repeated
// after another full pending_remind_days. Once a day is enough:
//
//   php /home/USER/path/to/backend-php/cron/payment-review-reminders.php
//
// It also runs on its own, at most every six hours, whenever someone opens a
// payment list, so a missing cron entry only delays it. Does nothing until the
// database update has run.
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

$sent = Gymlic\PaymentReminders::send(Gymlic\Database::connection());
$summary = Gymlic\PaymentReminders::summary($sent);
Gymlic\CronHeartbeat::record('payment-review-reminders', $summary);
echo date('Y-m-d H:i:s'), " {$summary}\n";
