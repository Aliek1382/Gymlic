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

use Gymlic\Controllers\AthleteController;
use Gymlic\Controllers\AdminController;
use Gymlic\Controllers\AuthController;
use Gymlic\Controllers\DashboardController;
use Gymlic\Controllers\EarningsController;
use Gymlic\Controllers\ReportController;
use Gymlic\Controllers\RevenueController;
use Gymlic\Controllers\ClubController;
use Gymlic\Controllers\LibraryController;
use Gymlic\Controllers\MemberController;
use Gymlic\Controllers\MessageController;
use Gymlic\Controllers\PlanController;
use Gymlic\Controllers\TrainerController;
use Gymlic\Controllers\WorkoutLogController;
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
$router->patch('/clubs/{id}', fn (array $p) => ClubController::update($p));
$router->post('/clubs/{id}/logo', fn (array $p) => UploadController::clubLogo($p));
$router->get('/clubs/{id}/membership-plans', fn (array $p) => ClubController::listMembershipPlans($p));
$router->post('/clubs/{id}/membership-plans', fn (array $p) => ClubController::createMembershipPlan($p));
$router->patch('/membership-plans/{id}', fn (array $p) => ClubController::updateMembershipPlan($p));
$router->delete('/membership-plans/{id}', fn (array $p) => ClubController::deleteMembershipPlan($p));

$router->get('/clubs/{id}/members', fn (array $p) => MemberController::listMembers($p));
$router->get('/clubs/{id}/members/{membershipId}/profile', fn (array $p) => MemberController::memberProfile($p));
$router->get('/clubs/{id}/member-invites', fn (array $p) => MemberController::listInvites($p));
$router->post('/clubs/{id}/member-invites', fn (array $p) => MemberController::createInvite($p));
$router->get('/clubs/{id}/trainer-options', fn (array $p) => MemberController::listTrainerOptions($p));
$router->get('/clubs/{id}/capacity', fn (array $p) => MemberController::capacity($p));
$router->patch('/memberships/{id}', fn (array $p) => MemberController::updateMembership($p));
$router->delete('/memberships/{id}', fn (array $p) => MemberController::removeMember($p));
$router->post('/invitations/{id}/revoke', fn (array $p) => MemberController::revokeInvite($p));

$router->get('/clubs/{id}/trainers', fn (array $p) => TrainerController::list($p));
$router->get('/clubs/{id}/trainer-invites', fn (array $p) => TrainerController::listInvites($p));
$router->post('/clubs/{id}/trainer-invites', fn (array $p) => TrainerController::createInvite($p));
$router->patch('/trainer-memberships/{id}', fn (array $p) => TrainerController::updateMembership($p));
$router->delete('/trainer-memberships/{id}', fn (array $p) => TrainerController::remove($p));

$router->get('/athletes', fn () => AthleteController::list());
$router->get('/athletes/{id}', fn (array $p) => AthleteController::get($p));
$router->patch('/athletes/{id}/note', fn (array $p) => AthleteController::updateNote($p));
$router->delete('/athletes/{id}', fn (array $p) => AthleteController::remove($p));
$router->get('/athlete-invites', fn () => AthleteController::listInvites());
$router->post('/athlete-invites', fn () => AthleteController::createInvite());
$router->post('/athlete-invites/{id}/revoke', fn (array $p) => AthleteController::revokeInvite($p));
$router->get('/trainer/club', fn () => AthleteController::club());

$router->get('/plans/{kind}', fn (array $p) => PlanController::list($p));
$router->get('/plans/{kind}/mine', fn (array $p) => PlanController::listMine($p));
$router->get('/plans/{kind}/templates', fn (array $p) => PlanController::listTemplates($p));
$router->post('/plans/{kind}/templates', fn (array $p) => PlanController::saveTemplate($p));
$router->delete('/plans/{kind}/templates/{id}', fn (array $p) => PlanController::deleteTemplate($p));
$router->post('/plans/{kind}', fn (array $p) => PlanController::save($p));
$router->get('/plans/{kind}/{id}', fn (array $p) => PlanController::get($p));
$router->post('/plans/{kind}/{id}/complete', fn (array $p) => PlanController::complete($p));
$router->delete('/plans/{kind}/{id}', fn (array $p) => PlanController::remove($p));

$router->get('/workout-day-logs', fn () => WorkoutLogController::list());
$router->post('/workout-day-logs', fn () => WorkoutLogController::create());
$router->delete('/workout-day-logs/{id}', fn (array $p) => WorkoutLogController::remove($p));

$router->get('/library/{kind}', fn (array $p) => LibraryController::list($p));
$router->get('/library/{kind}/picker', fn (array $p) => LibraryController::picker($p));
$router->post('/library/{kind}', fn (array $p) => LibraryController::create($p));
$router->post('/library/{kind}/{id}/usage', fn (array $p) => LibraryController::recordUsage($p));

$router->get('/dashboard/athlete', fn () => DashboardController::athlete());
$router->get('/dashboard/trainer', fn () => DashboardController::trainer());
$router->get('/dashboard/club/{id}', fn (array $p) => DashboardController::club($p));

$router->get('/reports/trainer/monthly-stats', fn () => ReportController::monthlyStats());
$router->get('/reports/trainer/athlete-progress', fn () => ReportController::athleteProgress());
$router->get('/reports/trainer/weekly-adherence', fn () => ReportController::weeklyAdherence());
$router->get('/reports/trainer/completion-rates', fn () => ReportController::completionRates());
$router->get('/athletes/{id}/completed-plans', fn (array $p) => ReportController::completedPlans($p));

$router->get('/clubs/{id}/revenue', fn (array $p) => RevenueController::list($p));
$router->post('/clubs/{id}/revenue', fn (array $p) => RevenueController::create($p));
$router->patch('/revenue/{id}', fn (array $p) => RevenueController::update($p));
$router->delete('/revenue/{id}', fn (array $p) => RevenueController::remove($p));

$router->get('/earnings', fn () => EarningsController::list());
$router->post('/earnings', fn () => EarningsController::create());
$router->patch('/earnings/{id}', fn (array $p) => EarningsController::update($p));
$router->delete('/earnings/{id}', fn (array $p) => EarningsController::remove($p));

$router->get('/plans-catalog', fn () => AdminController::listPlans());
$router->get('/payment-requests', fn () => AdminController::listPaymentRequests());
$router->post('/payment-requests', fn () => AdminController::submitPaymentRequest());

$router->get('/admin/clubs', fn () => AdminController::listClubs());
$router->get('/admin/profiles', fn () => AdminController::listProfiles());
$router->get('/admin/activity', fn () => AdminController::listActivity());
$router->post('/admin/clubs/{id}/status', fn (array $p) => AdminController::setClubStatus($p));
$router->post('/admin/profiles/{id}/suspend', fn (array $p) => AdminController::setProfileSuspended($p));
$router->patch('/admin/profiles/{id}', fn (array $p) => AdminController::updateProfile($p));
$router->post('/admin/payment-requests/{id}/approve', fn (array $p) => AdminController::approvePaymentRequest($p));
$router->post('/admin/payment-requests/{id}/reject', fn (array $p) => AdminController::rejectPaymentRequest($p));
$router->post('/admin/plans', fn () => AdminController::createPlan());
$router->patch('/admin/plans/{id}', fn (array $p) => AdminController::updatePlan($p));

$router->get('/messages/threads', fn () => MessageController::threads());
$router->get('/messages/conversation/{id}', fn (array $p) => MessageController::conversation($p));
$router->post('/messages/conversation/{id}/read', fn (array $p) => MessageController::markRead($p));
$router->post('/messages', fn () => MessageController::send());
$router->get('/plans/{kind}/{id}/comments', fn (array $p) => MessageController::planComments($p));
$router->post('/plans/{kind}/{id}/comments', fn (array $p) => MessageController::addPlanComment($p));

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
