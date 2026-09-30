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

use Gymlic\Database;
use Gymlic\MailGateway;
use Gymlic\SmsGateway;

const MAX_ATTEMPTS = 3;
const BATCH = 50;

$pdo = Database::connection();

$rows = $pdo->query(
    "SELECT d.id, d.channel, d.attempts, n.title, n.body, p.phone, p.email
     FROM notification_deliveries d
     JOIN notifications n ON n.id = d.notification_id
     JOIN profiles p ON p.id = n.recipient_id
     WHERE d.status IN ('pending', 'failed') AND d.attempts < " . MAX_ATTEMPTS . '
     ORDER BY d.created_at
     LIMIT ' . BATCH
)->fetchAll();

$claim = $pdo->prepare(
    "UPDATE notification_deliveries SET attempts = attempts + 1
     WHERE id = :id AND attempts = :attempts AND status IN ('pending', 'failed')"
);
$sent = $pdo->prepare("UPDATE notification_deliveries SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = :id");
$failed = $pdo->prepare("UPDATE notification_deliveries SET status = 'failed', last_error = :error WHERE id = :id");

$ok = 0;
$bad = 0;
foreach ($rows as $row) {
    // Claim first, so two overlapping cron runs never send the same row twice.
    $claim->execute(['id' => $row['id'], 'attempts' => $row['attempts']]);
    if ($claim->rowCount() === 0) {
        continue;
    }

    $title = (string) $row['title'];
    $body = trim((string) ($row['body'] ?? ''));

    if ($row['channel'] === 'sms') {
        $result = SmsGateway::send((string) $row['phone'], $body === '' ? $title : $title . "\n" . $body);
        $error = SmsGateway::lastError();
    } else {
        $result = MailGateway::send((string) $row['email'], $title, $body === '' ? $title : $body);
        $error = MailGateway::lastError();
    }

    if ($result) {
        $sent->execute(['id' => $row['id']]);
        $ok++;
    } else {
        $failed->execute(['id' => $row['id'], 'error' => mb_substr($error !== '' ? $error : 'unknown error', 0, 500)]);
        $bad++;
        error_log("notification-dispatch {$row['channel']} {$row['id']}: {$error}");
    }
}

echo date('Y-m-d H:i:s'), " deliveries sent: {$ok}, failed: {$bad}\n";
