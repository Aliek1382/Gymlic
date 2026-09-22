<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Response.php';
require_once __DIR__ . '/../src/Uuid.php';
require_once __DIR__ . '/../src/Validate.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/InvitationController.php';
require_once __DIR__ . '/../src/Controllers/ClubController.php';

use Gymlic\Controllers\AuthController;
use Gymlic\Controllers\ClubController;
use Gymlic\Controllers\InvitationController;
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

try {
    $router->dispatch($_SERVER['REQUEST_METHOD'], $path);
} catch (Throwable $e) {
    Response::error(500, 'server_error', 'Something went wrong.');
}
