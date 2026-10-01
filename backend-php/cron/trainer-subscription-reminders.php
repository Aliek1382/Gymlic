<?php
declare(strict_types=1);

// Tells trainers their platform subscription is about to end (once, from the
// "running out" window set in the admin's billing page) and that it has ended
// (once). Meant for the host's cron, once a day is enough:
//
//   php /home/USER/path/to/backend-php/cron/trainer-subscription-reminders.php
//
// Safe to run any number of times: each notice is sent once per expiry. The
// same job also runs on its own, at most every six hours, when a trainer opens
// their subscription page or an admin opens the trainer payments, so a missing
// cron entry only delays it. The notices go out like any other notification
// (and by SMS/email through the notification-dispatch cron, for trainers who
// opted in).
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

if (!Gymlic\TrainerBilling::ready() || !Gymlic\TrainerBilling::remindersReady()) {
    echo date('Y-m-d H:i:s'), " trainer subscriptions: database update not run yet, nothing to do\n";
    exit;
}

$sent = Gymlic\TrainerBilling::sendReminders(Gymlic\Database::connection());
$summary = Gymlic\TrainerBilling::reminderSummary($sent);
Gymlic\CronHeartbeat::record('trainer-subscription-reminders', $summary);
echo date('Y-m-d H:i:s'), " {$summary}\n";
