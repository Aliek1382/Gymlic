<?php
declare(strict_types=1);

// Sends the SMS / email copies of notifications queued in notification_deliveries
// (AuthController::notify queues them; nothing is sent during a web request).
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

use Gymlic\CronHeartbeat;
use Gymlic\Database;
use Gymlic\DeliveryDispatcher;

const BATCH = 50;

$pdo = Database::connection();

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

$summary = "deliveries sent: {$ok}, failed: {$bad}";
CronHeartbeat::record('notification-dispatch', $summary);
echo date('Y-m-d H:i:s'), " {$summary}\n";
