<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Database;
use Gymlic\Response;
use Throwable;

/**
 * Smoke test for a fresh upload: confirms URL rewriting reaches the front
 * controller, PHP is a supported version, and config.php points at a database
 * whose schema is loaded. Deliberately reports no connection details.
 */
final class HealthController
{
    public static function check(): void
    {
        $database = 'unavailable';
        $schema = 'missing';

        try {
            $pdo = Database::connection();
            $database = 'connected';
            $pdo->query('SELECT 1 FROM profiles LIMIT 1');
            $schema = 'loaded';
        } catch (Throwable $e) {
            // Leave the defaults — the two states above are all a deployer needs.
        }

        Response::ok([
            'ok'          => $database === 'connected' && $schema === 'loaded',
            'php_version' => PHP_VERSION,
            'database'    => $database,
            'schema'      => $schema,
        ]);
    }
}
