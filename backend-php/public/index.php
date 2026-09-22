<?php
declare(strict_types=1);

// Maps Gymlic\Foo\Bar to src/Foo/Bar.php. Composer isn't available on the
// shared hosts this targets, and the mapping is one rule.
spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Gymlic\\')) {
        return;
    }
    $path = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen('Gymlic\\'))) . '.php';
    if (is_file($path)) {
        require_once $path;
    }
});

use Gymlic\Controllers\AuthController;
use Gymlic\Controllers\ClubController;
use Gymlic\Controllers\HealthController;
use Gymlic\Controllers\InvitationController;
use Gymlic\Controllers\NotificationController;
use Gymlic\Controllers\ProfileController;
use Gymlic\Controllers\ProgressController;
use Gymlic\Controllers\UploadController;
use Gymlic\Response;
use Gymlic\Router;

$config = require __DIR__ . '/../config.php';

// --- CORS -------------------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $config['cors_origins'], true) || in_array('*', $config['cors_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Routing ------------------------------------------------------------
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
// Strip a leading /api if the host maps this app under /api instead of its own subdomain.
$path = preg_replace('#^/api#', '', $path) ?: '/';

$router = new Router();

$router->get('/health', fn () => HealthController::check());

$router->post('/auth/signup', fn () => AuthController::signup());
$router->post('/auth/login', fn () => AuthController::login());
$router->post('/auth/logout', fn () => AuthController::logout());
$router->get('/auth/me', fn () => AuthController::me());
$router->post('/auth/choose-role', fn () => AuthController::chooseRole());

$router->get('/invitations/preview', fn () => AuthController::invitationPreview());
$router->post('/invitations/accept-athlete', fn () => InvitationController::acceptAthlete());
$router->post('/invitations/accept-club', fn () => InvitationController::acceptClub());

$router->post('/clubs', fn () => ClubController::create());
$router->get('/clubs/{id}', fn (array $p) => ClubController::get($p));
$router->post('/clubs/{id}/logo', fn (array $p) => UploadController::clubLogo($p));

$router->get('/profiles/{id}', fn (array $p) => ProfileController::get($p));
$router->patch('/me/profile', fn () => ProfileController::updateProfile());
$router->patch('/me/email', fn () => ProfileController::updateEmail());
$router->patch('/me/password', fn () => ProfileController::updatePassword());
$router->post('/me/avatar', fn () => UploadController::avatar());

$router->get('/athletes/{id}/measurements', fn (array $p) => ProgressController::list($p));
$router->post('/athletes/{id}/measurements', fn (array $p) => ProgressController::create($p));
$router->patch('/measurements/{id}', fn (array $p) => ProgressController::update($p));

$router->get('/notifications', fn () => NotificationController::list());
$router->get('/notifications/archive', fn () => NotificationController::archive());
$router->post('/notifications/{id}/read', fn (array $p) => NotificationController::markRead($p));
$router->post('/notifications/read-all', fn () => NotificationController::markAllRead());
$router->post('/admin/notifications/broadcast', fn () => NotificationController::broadcast());

try {
    $router->dispatch($_SERVER['REQUEST_METHOD'], $path);
} catch (PDOException $e) {
    Response::error(500, 'db_connection_failed', 'Could not reach the database.');
} catch (Throwable $e) {
    Response::error(500, 'server_error', 'Something went wrong.');
}
