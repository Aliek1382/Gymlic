<?php
declare(strict_types=1);

// Sends scheduled admin broadcasts once their time comes, and the SMS / email
// copies of notifications queued in notification_deliveries
// (AuthController::notify queues them; nothing is sent during a web request).
// Also sends the weekly email report on Saturday morning (WeeklyReport) and
// empties the recycle bin of items older than 30 days (Trash), and tells the
// owner on Telegram, once a day, which subscriptions are about to run out.
// Meant for the host's cron, every 5 minutes:
//
//   php /home/USER/path/to/backend-php/cron/notification-dispatch.php
//
// Sends up to 50 rows per run. A row that fails is retried on later runs until it
// has been tried 3 times, then left as 'failed'.
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

use Gymlic\Broadcasts;
use Gymlic\CronHeartbeat;
use Gymlic\Database;
use Gymlic\DeliveryDispatcher;
use Gymlic\ExpiryAlerts;
use Gymlic\Trash;
use Gymlic\WeeklyReport;

const BATCH = 50;

$pdo = Database::connection();

// Scheduled broadcasts whose time has come: written as notifications (and
// SMS / email rows), which the loop below then starts sending.
$broadcasts = Broadcasts::sendDue($pdo);

$ok = 0;
$bad = 0;
foreach (DeliveryDispatcher::due($pdo, BATCH) as $row) {
    $result = DeliveryDispatcher::send($pdo, $row);
    if ($result === null) {
        continue; // another run took it
    }
    if ($result[0]) {
        $ok++;
    } else {
        $bad++;
        error_log("notification-dispatch {$row['channel']} {$row['id']}: {$result[1]}");
    }
}

// The weekly email report rides this cron: on Saturday morning, once.
$weekly = WeeklyReport::sendIfDue($pdo);
// And the recycle bin's 30-day clean-up, a few times a day at most.
Trash::purgeIfDue($pdo);
// And, once a day, the owner's Telegram note on subscriptions about to run out.
$expiry = ExpiryAlerts::sendIfDue($pdo);

$summary = "broadcasts: {$broadcasts}, deliveries sent: {$ok}, failed: {$bad}" . ($weekly !== null ? ", {$weekly}" : '') . ($expiry !== null ? ", {$expiry}" : '');
CronHeartbeat::record('notification-dispatch', $summary);
echo date('Y-m-d H:i:s'), " {$summary}\n";
