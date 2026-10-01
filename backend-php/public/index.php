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
use Gymlic\Controllers\AdminLibraryController;
use Gymlic\Controllers\AdminPointsController;
use Gymlic\Controllers\AdminRolesController;
use Gymlic\Controllers\AdminSystemController;
use Gymlic\Controllers\AdminUsersController;
use Gymlic\Controllers\AuthController;
use Gymlic\Controllers\CalendarController;
use Gymlic\Controllers\DashboardController;
use Gymlic\Controllers\EarningsController;
use Gymlic\Controllers\ReportController;
use Gymlic\Controllers\RevenueController;
use Gymlic\Controllers\ClubController;
use Gymlic\Controllers\LibraryController;
use Gymlic\Controllers\MemberController;
use Gymlic\Controllers\MessageController;
use Gymlic\Controllers\TicketController;
use Gymlic\Controllers\InvoiceController;
use Gymlic\Controllers\NutritionPlanBuilderController;
use Gymlic\Controllers\PlanController;
use Gymlic\Controllers\PointsController;
use Gymlic\Controllers\SessionPackageController;
use Gymlic\Controllers\SupplementController;
use Gymlic\Controllers\TechniqueController;
use Gymlic\Controllers\TrainerController;
use Gymlic\Controllers\WorkoutLogController;
use Gymlic\Controllers\HealthController;
use Gymlic\Controllers\InvitationController;
use Gymlic\Controllers\NoteController;
use Gymlic\Controllers\NotificationController;
use Gymlic\Controllers\ProfileController;
use Gymlic\Controllers\ProgressController;
use Gymlic\Controllers\PushController;
use Gymlic\Controllers\QuestionnaireController;
use Gymlic\Controllers\SecurityController;
use Gymlic\Controllers\SettingsController;
use Gymlic\Controllers\TrainerProfileController;
use Gymlic\Controllers\UploadController;
use Gymlic\Controllers\WorkoutPlanBuilderController;
use Gymlic\Gate;
use Gymlic\Response;
use Gymlic\Router;

$config = require __DIR__ . '/../config.php';

// --- CORS -------------------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $config['cors_origins'], true) || in_array('*', $config['cors_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

$router->get('/settings/public', fn () => SettingsController::publicSettings());

$router->post('/auth/signup', fn () => AuthController::signup());
$router->post('/auth/login', fn () => AuthController::login());
$router->post('/auth/login/verify', fn () => AuthController::verifyLogin());
$router->post('/auth/login/resend', fn () => AuthController::resendLoginCode());
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
$router->patch('/athletes/{id}/nutrition-goal', fn (array $p) => AthleteController::updateNutritionGoal($p));
$router->delete('/athletes/{id}', fn (array $p) => AthleteController::remove($p));
$router->get('/athlete-invites', fn () => AthleteController::listInvites());
$router->post('/athlete-invites', fn () => AthleteController::createInvite());
$router->post('/athlete-invites/{id}/revoke', fn (array $p) => AthleteController::revokeInvite($p));
$router->get('/trainer/club', fn () => AthleteController::club());

$router->post('/invoices', fn () => InvoiceController::create());
$router->get('/invoices', fn () => InvoiceController::list());
$router->get('/invoices/mine', fn () => InvoiceController::listMine());
$router->patch('/invoices/{id}/mark-paid', fn (array $p) => InvoiceController::markPaid($p));
$router->patch('/invoices/{id}/cancel', fn (array $p) => InvoiceController::cancel($p));

$router->post('/session-packages', fn () => SessionPackageController::create());
$router->get('/session-packages', fn () => SessionPackageController::list());
$router->get('/session-packages/mine', fn () => SessionPackageController::listMine());
$router->get('/session-packages/{id}/sessions', fn (array $p) => SessionPackageController::listSessions($p));
$router->patch('/session-packages/{id}/sessions/{sessionId}', fn (array $p) => SessionPackageController::updateSession($p));

$router->get('/points/me', fn () => PointsController::me());
$router->get('/notes', fn () => NoteController::list());
$router->post('/notes', fn () => NoteController::create());
$router->patch('/notes/{id}', fn (array $p) => NoteController::update($p));
$router->delete('/notes/{id}', fn (array $p) => NoteController::delete($p));

$router->post('/supplement-plans', fn () => SupplementController::create());
$router->get('/supplement-plans', fn () => SupplementController::list());
$router->get('/supplement-plans/mine', fn () => SupplementController::listMine());
$router->patch('/supplement-plans/{id}', fn (array $p) => SupplementController::update($p));
$router->delete('/supplement-plans/{id}', fn (array $p) => SupplementController::delete($p));

// Static paths before {id}: 'mine' and 'responses' must not be read as ids.
$router->post('/questionnaires', fn () => QuestionnaireController::create());
$router->get('/questionnaires', fn () => QuestionnaireController::list());
$router->get('/questionnaires/mine', fn () => QuestionnaireController::listMine());
$router->post('/questionnaires/responses/{id}/submit', fn (array $p) => QuestionnaireController::submit($p));
$router->patch('/questionnaires/{id}', fn (array $p) => QuestionnaireController::update($p));
$router->delete('/questionnaires/{id}', fn (array $p) => QuestionnaireController::delete($p));
$router->post('/questionnaires/{id}/assign', fn (array $p) => QuestionnaireController::assign($p));
$router->get('/questionnaires/{id}/responses', fn (array $p) => QuestionnaireController::responses($p));

$router->get('/push/public-key', fn () => PushController::publicKey());
$router->post('/push/subscriptions', fn () => PushController::subscribe());
$router->post('/push/unsubscribe', fn () => PushController::unsubscribe());
$router->post('/push/test', fn () => PushController::test());

$router->get('/calendar/events', fn () => CalendarController::list());
$router->post('/calendar/events', fn () => CalendarController::create());
$router->patch('/calendar/events/{id}', fn (array $p) => CalendarController::update($p));
$router->delete('/calendar/events/{id}', fn (array $p) => CalendarController::remove($p));

$router->get('/plans/{kind}', fn (array $p) => PlanController::list($p));
$router->get('/plans/{kind}/mine', fn (array $p) => PlanController::listMine($p));
$router->get('/plans/{kind}/templates', fn (array $p) => PlanController::listTemplates($p));
$router->post('/plans/{kind}/templates', fn (array $p) => PlanController::saveTemplate($p));
$router->post('/plans/{kind}/templates/{id}/apply', fn (array $p) => PlanController::applyTemplate($p));
$router->delete('/plans/{kind}/templates/{id}', fn (array $p) => PlanController::deleteTemplate($p));
$router->post('/plans/{kind}', fn (array $p) => PlanController::save($p));
$router->get('/plans/{kind}/{id}', fn (array $p) => PlanController::get($p));
$router->post('/plans/{kind}/{id}/complete', fn (array $p) => PlanController::complete($p));
$router->delete('/plans/{kind}/{id}', fn (array $p) => PlanController::remove($p));

$router->get('/plans/workout/{id}/days', fn (array $p) => WorkoutPlanBuilderController::listDays($p));
$router->post('/plans/workout/{id}/days', fn (array $p) => WorkoutPlanBuilderController::createDay($p));
$router->put('/plans/workout/{id}/days/{dayId}', fn (array $p) => WorkoutPlanBuilderController::updateDay($p));
$router->delete('/plans/workout/{id}/days/{dayId}', fn (array $p) => WorkoutPlanBuilderController::deleteDay($p));
$router->post('/plans/workout/{id}/days/{dayId}/exercises', fn (array $p) => WorkoutPlanBuilderController::addExercise($p));
$router->patch('/plans/workout/{id}/days/{dayId}/exercises/{exId}', fn (array $p) => WorkoutPlanBuilderController::updateExercise($p));
$router->delete('/plans/workout/{id}/days/{dayId}/exercises/{exId}', fn (array $p) => WorkoutPlanBuilderController::deleteExercise($p));
$router->post('/plans/workout/{id}/days/{dayId}/copy', fn (array $p) => WorkoutPlanBuilderController::copyDay($p));
$router->post('/plans/workout/{id}/weeks/{weekNumber}/copy', fn (array $p) => WorkoutPlanBuilderController::copyWeek($p));

$router->get('/plans/nutrition/{id}/meals', fn (array $p) => NutritionPlanBuilderController::listMeals($p));
$router->post('/plans/nutrition/{id}/meals', fn (array $p) => NutritionPlanBuilderController::createMeal($p));
$router->patch('/plans/nutrition/{id}/meals/{mealId}', fn (array $p) => NutritionPlanBuilderController::updateMeal($p));
$router->delete('/plans/nutrition/{id}/meals/{mealId}', fn (array $p) => NutritionPlanBuilderController::deleteMeal($p));
$router->post('/plans/nutrition/{id}/meals/{mealId}/items', fn (array $p) => NutritionPlanBuilderController::addItem($p));
$router->patch('/plans/nutrition/{id}/meals/{mealId}/items/{itemId}', fn (array $p) => NutritionPlanBuilderController::updateItem($p));
$router->delete('/plans/nutrition/{id}/meals/{mealId}/items/{itemId}', fn (array $p) => NutritionPlanBuilderController::deleteItem($p));

$router->get('/workout-day-logs', fn () => WorkoutLogController::list());
$router->post('/workout-day-logs', fn () => WorkoutLogController::create());
$router->delete('/workout-day-logs/{id}', fn (array $p) => WorkoutLogController::remove($p));

$router->get('/library/{kind}', fn (array $p) => LibraryController::list($p));
$router->get('/library/{kind}/picker', fn (array $p) => LibraryController::picker($p));
$router->post('/library/{kind}', fn (array $p) => LibraryController::create($p));
$router->post('/library/{kind}/{id}/usage', fn (array $p) => LibraryController::recordUsage($p));

$router->get('/techniques', fn () => TechniqueController::list());
$router->post('/techniques', fn () => TechniqueController::create());
$router->patch('/techniques/{id}', fn (array $p) => TechniqueController::update($p));
$router->delete('/techniques/{id}', fn (array $p) => TechniqueController::delete($p));

$router->get('/dashboard/athlete', fn () => DashboardController::athlete());
$router->get('/dashboard/trainer', fn () => DashboardController::trainer());
$router->get('/dashboard/club/{id}', fn (array $p) => DashboardController::club($p));

$router->get('/reports/trainer/monthly-stats', fn () => ReportController::monthlyStats());
$router->get('/reports/trainer/athlete-progress', fn () => ReportController::athleteProgress());
$router->get('/reports/trainer/weekly-adherence', fn () => ReportController::weeklyAdherence());
$router->get('/reports/trainer/completion-rates', fn () => ReportController::completionRates());
$router->get('/reports/financial-summary', fn () => ReportController::financialSummary());
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

$router->get('/admin/overview', fn () => AdminController::overview());
$router->get('/admin/clubs', fn () => AdminController::listClubs());
$router->get('/admin/club-options', fn () => AdminController::listClubOptions());
$router->get('/admin/clubs/{id}', fn (array $p) => AdminController::clubDetail($p));
$router->get('/admin/trainers/{id}', fn (array $p) => AdminController::trainerDetail($p));
$router->get('/admin/profiles', fn () => AdminController::listProfiles());
$router->get('/admin/activity', fn () => AdminController::listActivity());
$router->post('/admin/clubs/{id}/status', fn (array $p) => AdminController::setClubStatus($p));
$router->post('/admin/profiles/{id}/suspend', fn (array $p) => AdminController::setProfileSuspended($p));
$router->patch('/admin/profiles/{id}', fn (array $p) => AdminController::updateProfile($p));
$router->post('/admin/payment-requests/{id}/approve', fn (array $p) => AdminController::approvePaymentRequest($p));
$router->post('/admin/payment-requests/{id}/reject', fn (array $p) => AdminController::rejectPaymentRequest($p));
$router->post('/admin/plans', fn () => AdminController::createPlan());
$router->patch('/admin/plans/{id}', fn (array $p) => AdminController::updatePlan($p));
$router->get('/admin/settings', fn () => SettingsController::adminGet());
$router->post('/admin/settings/test-sms', fn () => SettingsController::testSms());
$router->post('/admin/settings/test-mail', fn () => SettingsController::testMail());
$router->put('/admin/settings/{key}', fn (array $p) => SettingsController::adminUpdate($p));
$router->get('/admin/users', fn () => AdminUsersController::list());
$router->get('/admin/system/health', fn () => AdminSystemController::health());
$router->get('/admin/system/alerts', fn () => AdminSystemController::alerts());
$router->get('/admin/system/migrations', fn () => AdminSystemController::migrations());
$router->post('/admin/system/migrations/{id}/run', fn (array $p) => AdminSystemController::runMigration($p));
$router->get('/admin/system/backup', fn () => AdminSystemController::backup());
$router->get('/admin/deliveries', fn () => AdminSystemController::deliveries());
$router->post('/admin/deliveries/retry-failed', fn () => AdminSystemController::retryAllFailed());
$router->post('/admin/deliveries/{id}/retry', fn (array $p) => AdminSystemController::retryDelivery($p));
$router->post('/admin/deliveries/{id}/send', fn (array $p) => AdminSystemController::sendDelivery($p));
$router->patch('/admin/users/{id}/role', fn (array $p) => AdminUsersController::setRole($p));
$router->post('/admin/users/{id}/admin', fn (array $p) => AdminUsersController::setAdmin($p));
$router->post('/admin/users/{id}/password', fn (array $p) => AdminUsersController::setPassword($p));
$router->get('/admin/users/{id}/sessions', fn (array $p) => AdminUsersController::sessions($p));
$router->delete('/admin/users/{id}/sessions', fn (array $p) => AdminUsersController::revokeSessions($p));
$router->delete('/admin/users/{id}/sessions/{sid}', fn (array $p) => AdminUsersController::revokeSessions($p));
$router->get('/admin/roles', fn () => AdminRolesController::list());
$router->post('/admin/roles', fn () => AdminRolesController::create());
$router->patch('/admin/roles/{id}', fn (array $p) => AdminRolesController::update($p));
$router->delete('/admin/roles/{id}', fn (array $p) => AdminRolesController::delete($p));
$router->get('/admin/security', fn () => SecurityController::overview());
$router->post('/admin/security/2fa/start', fn () => SecurityController::start2fa());
$router->post('/admin/security/2fa/confirm', fn () => SecurityController::confirm2fa());
$router->post('/admin/security/unlock', fn () => SecurityController::unlock());
$router->get('/admin/library/{kind}', fn (array $p) => AdminLibraryController::list($p));
$router->post('/admin/library/{kind}', fn (array $p) => AdminLibraryController::create($p));
$router->patch('/admin/library/{kind}/{id}', fn (array $p) => AdminLibraryController::update($p));
$router->delete('/admin/library/{kind}/{id}', fn (array $p) => AdminLibraryController::delete($p));
$router->post('/admin/library/{kind}/{id}/publish', fn (array $p) => AdminLibraryController::publish($p));
$router->get('/admin/points', fn () => AdminPointsController::overview());
$router->patch('/admin/points/rules/{action}', fn (array $p) => AdminPointsController::updateRule($p));
$router->post('/admin/points/adjust', fn () => AdminPointsController::adjust());

$router->get('/messages/threads', fn () => MessageController::threads());
$router->get('/messages/conversation/{id}', fn (array $p) => MessageController::conversation($p));
$router->post('/messages/conversation/{id}/read', fn (array $p) => MessageController::markRead($p));
$router->post('/messages', fn () => MessageController::send());
$router->post('/messages/archive/{id}', fn (array $p) => MessageController::archive($p));
$router->delete('/messages/archive/{id}', fn (array $p) => MessageController::unarchive($p));
$router->post('/uploads/message-media', fn () => UploadController::messageMedia());
$router->get('/plans/{kind}/{id}/comments', fn (array $p) => MessageController::planComments($p));
$router->post('/plans/{kind}/{id}/comments', fn (array $p) => MessageController::addPlanComment($p));

$router->get('/trainer-profile', fn () => TrainerProfileController::mine());
$router->put('/trainer-profile', fn () => TrainerProfileController::save());
$router->post('/trainer-profile/certificates', fn () => TrainerProfileController::uploadCertificate());
$router->get('/trainer-profile/{trainerId}', fn (array $p) => TrainerProfileController::view($p));

$router->get('/tickets/mine', fn () => TicketController::listMine());
$router->get('/tickets/trainers', fn () => TicketController::trainers());
$router->get('/tickets', fn () => TicketController::listForTrainer());
$router->post('/tickets', fn () => TicketController::create());
$router->get('/tickets/{id}', fn (array $p) => TicketController::get($p));
$router->post('/tickets/{id}/messages', fn (array $p) => TicketController::addMessage($p));
$router->patch('/tickets/{id}/status', fn (array $p) => TicketController::setStatus($p));

$router->get('/profiles/{id}', fn (array $p) => ProfileController::get($p));
$router->patch('/me/profile', fn () => ProfileController::updateProfile());
$router->patch('/me/email', fn () => ProfileController::updateEmail());
$router->patch('/me/password', fn () => ProfileController::updatePassword());
$router->post('/me/avatar', fn () => UploadController::avatar());

$router->get('/athletes/{id}/measurements', fn (array $p) => ProgressController::list($p));
$router->post('/athletes/{id}/measurements', fn (array $p) => ProgressController::create($p));
$router->patch('/measurements/{id}', fn (array $p) => ProgressController::update($p));
$router->get('/progress/reminders/{athleteId}', fn (array $p) => ProgressController::getReminder($p));
$router->put('/progress/reminders/{athleteId}', fn (array $p) => ProgressController::setReminder($p));

$router->get('/notifications', fn () => NotificationController::list());
$router->get('/notifications/archive', fn () => NotificationController::archive());
$router->post('/notifications/{id}/read', fn (array $p) => NotificationController::markRead($p));
$router->post('/notifications/read-all', fn () => NotificationController::markAllRead());
$router->post('/admin/notifications/broadcast', fn () => NotificationController::broadcast());

try {
    // Maintenance mode and switched-off sections, before any endpoint runs.
    Gate::enforce('/' . trim($path, '/'));
    $router->dispatch($_SERVER['REQUEST_METHOD'], $path);
} catch (PDOException $e) {
    Response::error(500, 'db_connection_failed', 'Could not reach the database.');
} catch (Throwable $e) {
    Response::error(500, 'server_error', 'Something went wrong.');
}
