<?php
declare(strict_types=1);

// Deletes the payment receipts (photos/PDFs) of requests that were reviewed
// more than the configured number of days ago (admin panel -> payment info),
// and any receipt file no request points to any more. Meant for the host's
// cron, once a day is enough:
//
//   php /home/USER/path/to/backend-php/cron/receipt-cleanup.php
//
// Safe to run any number of times. The same cleanup also runs on its own,
// at most every six hours, when a club files a request or an admin opens the
// payment requests, so a missing cron entry only delays it.
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

if (!Gymlic\Receipts::ready()) {
    echo date('Y-m-d H:i:s'), " receipts: database update not run yet, nothing to do\n";
    exit;
}

$result = Gymlic\Receipts::purgeExpired(Gymlic\Database::connection());
$summary = Gymlic\Receipts::summary($result);
Gymlic\CronHeartbeat::record('receipt-cleanup', $summary);
echo date('Y-m-d H:i:s'), " {$summary}\n";
