<?php
declare(strict_types=1);

// Copies the newest articles of gymlic.ir's WordPress RSS feed into the panel's news. Meant for
// the host's cron, once an hour is plenty:
//
//   php /home/USER/path/to/backend-php/cron/news-fetch.php
//
// Running it again imports nothing twice (news_items.link_hash is unique), and a feed that is down
// or malformed just logs the reason and exits: the articles already stored stay as they are.
// The feed address is gymlic.ir/feed/ unless config.php sets 'news_feed_url'.
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

try {
    $added = Gymlic\Controllers\NewsController::syncFeed();
    echo date('Y-m-d H:i:s'), " news imported: {$added}\n";
} catch (Throwable $e) {
    fwrite(STDERR, date('Y-m-d H:i:s') . ' news fetch failed: ' . $e->getMessage() . "\n");
    exit(1);
}
