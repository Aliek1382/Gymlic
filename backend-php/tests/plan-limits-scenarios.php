<?php
declare(strict_types=1);

/**
 * End-to-end check of the plan limits (src/Limits.php) against a local API
 * and database. LOCAL ONLY: it creates accounts, changes settings and runs
 * the database update. Never point it at the live site.
 *
 *   1. A database with the schema from before plan-limits-update.sql:
 *        mysql gymlic_dev < schema.sql   (from the commit before this change)
 *   2. ./dev-server.sh                    (API on 127.0.0.1:8099)
 *   3. php tests/plan-limits-scenarios.php
 *
 * Reads the same GYMLIC_DB_* variables as dev-server.sh.
 */

$api = getenv('GYMLIC_TEST_API') ?: 'http://127.0.0.1:8099';
$dbName = getenv('GYMLIC_DB_NAME') ?: 'gymlic_dev';
if (!str_ends_with($dbName, '_dev') && !str_ends_with($dbName, '_test')) {
    fwrite(STDERR, "Refusing to run against database '{$dbName}': only *_dev or *_test.\n");
    exit(2);
}
$pdo = new PDO(
    'mysql:host=' . (getenv('GYMLIC_DB_HOST') ?: 'localhost') . ";dbname={$dbName};charset=utf8mb4",
    getenv('GYMLIC_DB_USER') ?: 'gymlic',
    getenv('GYMLIC_DB_PASS') ?: 'gymlic_pw',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

require_once __DIR__ . '/../src/Jalali.php';

$failures = 0;
$run = bin2hex(random_bytes(3));

function call(string $method, string $path, ?array $body = null, ?string $token = null): array
{
    global $api;
    $ch = curl_init($api . $path);
    $headers = ['Content-Type: application/json', 'Origin: http://localhost:3000'];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => $body === null ? null : json_encode($body),
    ]);
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($raw, true);
    return [$status, is_array($json) ? ($json['data'] ?? $json) : ['raw' => $raw]];
}

function check(bool $ok, string $label, mixed $detail = null): void
{
    global $failures;
    echo ($ok ? "  ✔ " : "  ✘ ") . $label . ($ok || $detail === null ? '' : '  → ' . json_encode($detail, JSON_UNESCAPED_UNICODE)) . "\n";
    if (!$ok) {
        $failures++;
    }
}

/** @return array{0: string, 1: string} token, id */
function account(string $who, ?string $role): array
{
    global $run;
    [$status, $data] = call('POST', '/auth/signup', [
        'email' => "{$who}-{$run}@example.test", 'password' => 'password123', 'first_name' => $who, 'last_name' => 'تست',
    ]);
    if ($status !== 201) {
        throw new RuntimeException("signup {$who}: {$status} " . json_encode($data));
    }
    if ($role !== null) {
        call('POST', '/auth/choose-role', ['account_type' => $role], $data['token']);
    }
    return [$data['token'], $data['user']['id']];
}

function invite(string $token): array
{
    return call('POST', '/athlete-invites', ['first_name' => 'ورزشکار'], $token);
}

/** A new athlete accepting the invite with this code; returns [status, data, athlete id]. */
function accept(string $code, string $name): array
{
    [$token, $id] = account($name, null);
    [$status, $data] = call('POST', '/invitations/accept-athlete', ['code' => $code], $token);
    return [$status, $data, $id, $token];
}

function limits(string $token): array
{
    return call('GET', '/trainer-billing', null, $token)[1]['limits'] ?? [];
}

function admin(string $kind, string $id, array $body): array
{
    global $adminToken;
    return call('POST', "/admin/plan-accounts/{$kind}/{$id}", $body, $adminToken);
}

$day = static fn (int $offset): string => date('Y-m-d', strtotime(($offset >= 0 ? '+' : '') . $offset . ' days'));

echo "Setup\n";
[$adminToken, $adminId] = account('admin', null);
$pdo->prepare('UPDATE profiles SET is_platform_admin = 1 WHERE id = :id')->execute(['id' => $adminId]);

$migrations = call('GET', '/admin/system/migrations', null, $adminToken)[1];
$state = array_column($migrations['items'] ?? $migrations, 'state', 'id')['plan-limits'] ?? null;
if ($state === 'pending') {
    [$status, $result] = call('POST', '/admin/system/migrations/plan-limits/run', null, $adminToken);
    check($status === 200 && ($result['ok'] ?? false), 'database update runs from the admin panel', $result);
}
[$status, $again] = call('POST', '/admin/system/migrations/plan-limits/run', null, $adminToken);
check(!($again['ok'] ?? true), 'and is not run a second time', $again);

[$status] = call('PUT', '/admin/settings/billing', ['value' => [
    'trainer_enforce' => true, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false,
]], $adminToken);
check($status === 200, 'enforcement switched on');

$plans = $pdo->query('SELECT id, name, is_free FROM trainer_plans WHERE is_active = 1')->fetchAll();
$tPlan = array_column($plans, 'id', 'name');
$cPlan = array_column($pdo->query('SELECT id, name FROM plans WHERE is_active = 1')->fetchAll(), 'id', 'name');

echo "\n1. A free trainer cannot invite a fourth athlete\n";
[$t1, $t1Id] = account('trainer1', 'trainer');
$codes = [];
for ($i = 1; $i <= 3; $i++) {
    [$status, $data] = invite($t1);
    check($status === 201, "invite {$i} of 3", $data);
    $codes[] = $data['code'] ?? '';
}
[$status, $data] = invite($t1);
check($status === 402 && ($data['error']['code'] ?? $data['code'] ?? '') === 'plan_limit', 'the fourth is refused (402 plan_limit)', [$status, $data]);
$athletes = [];
foreach ($codes as $i => $code) {
    [$status, , $aid, $atoken] = accept($code, "athlete1-{$i}");
    $athletes[] = ['id' => $aid, 'token' => $atoken];
}
$l = limits($t1);
check(($l['plan']['is_free'] ?? false) && $l['max_athletes'] === 3 && $l['usage']['active'] === 3, 'free plan, 3 of 3 used', $l);

echo "\n2. After a silver payment is approved: up to 15\n";
[$status, $data] = call('POST', '/trainer-billing/requests', [
    'plan_id' => $tPlan['نقره‌ای'], 'tracking_code' => 'TRK' . $run, 'card_last4' => '1234',
], $t1);
check($status === 201, 'trainer files the payment', $data);
[$status, $data] = call('POST', '/admin/trainer-billing/requests/' . ($data['id'] ?? '') . '/approve', ['admin_note' => 'ok'], $adminToken);
check($status === 200, 'admin approves', $data);
$ok = 0;
for ($i = 0; $i < 12; $i++) {
    [$status, $data] = invite($t1);
    $ok += $status === 201 ? 1 : 0;
    if ($i < 5) {
        $athletes[] = ['id' => accept($data['code'], "athlete1-x{$i}")[2]];
    }
}
check($ok === 12, '12 more invites go through (15 with the 3 athletes)', $ok);
[$status] = invite($t1);
check($status === 402, 'the sixteenth is refused');
check(limits($t1)['max_athletes'] === 15, 'cap is 15');

echo "\n3. A silver club cannot invite a fourth trainer\n";
[$owner, $ownerId] = account('owner', 'club');
[, $club] = call('POST', '/clubs', ['name' => 'باشگاه تست ' . $run], $owner);
$clubId = $club['id'] ?? $club['club']['id'] ?? $pdo->query("SELECT id FROM clubs WHERE owner_id = '{$ownerId}'")->fetchColumn();
call('POST', "/admin/clubs/{$clubId}/status", ['status' => 'active'], $adminToken);
[$status, $data] = call('POST', "/clubs/{$clubId}/member-invites", [], $owner);
check($status === 402, 'without a plan the club cannot invite', [$status, $data]);
[$status, $data] = admin('club', $clubId, ['action' => 'activate', 'plan_id' => $cPlan['نقره‌ای'], 'expires_at' => $day(30)]);
check($status === 200 && $data['account']['limits']['max_trainers'] === 3, 'admin activates silver (3 trainers)', $data);
$trainerCodes = [];
for ($i = 1; $i <= 3; $i++) {
    [$status, $data] = call('POST', "/clubs/{$clubId}/trainer-invites", ['first_name' => "مربی {$i}"], $owner);
    check($status === 201, "trainer invite {$i}", $data);
    $trainerCodes[] = $data['code'] ?? '';
}
[$status, $data] = call('POST', "/clubs/{$clubId}/trainer-invites", [], $owner);
check($status === 409, 'the fourth trainer invite is refused (409)', [$status, $data]);

echo "\n4/5. Admin dates: an end in the past starts the grace days, then the free plan\n";
[$t2, $t2Id] = account('trainer2', 'trainer');
[$status, $data] = admin('trainer', $t2Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'started_at' => $day(1), 'expires_at' => $day(30)]);
check($status === 400, 'a start date in the future is refused', $data);
[$status, $data] = admin('trainer', $t2Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'started_at' => $day(-10), 'expires_at' => $day(-11)]);
check($status === 400, 'an end before the start is refused', $data);
[$status, $data] = admin('trainer', $t2Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'started_at' => $day(-10), 'expires_at' => $day(30), 'note' => 'سالانه دستی']);
check($status === 200 && limits($t2)['max_athletes'] === 40, 'gold from 10 days ago: cap 40 at once', $data);
[$status, $data] = admin('trainer', $t2Id, ['action' => 'dates', 'expires_at' => $day(-1), 'preview' => true]);
check(($data['after']['status'] ?? '') === 'grace' && limits($t2)['status'] === 'active', 'preview shows grace without saving', $data);
admin('trainer', $t2Id, ['action' => 'dates', 'expires_at' => $day(-1)]);
$l = limits($t2);
check($l['status'] === 'grace' && $l['max_athletes'] === 40, 'end yesterday: in grace, still 40 (not back to free)', $l);
admin('trainer', $t2Id, ['action' => 'dates', 'expires_at' => $day(-10)]);
$l = limits($t2);
check($l['status'] === 'expired' && $l['max_athletes'] === 3, 'end 10 days ago: free plan, 3', $l);

echo "\n6. After the grace days the extra athletes are suspended, and come back on renewal\n";
[$status, $data] = admin('trainer', $t1Id, ['action' => 'dates', 'expires_at' => $day(-9)]);
check($status === 400, 'an end before the current start is refused', $data);
admin('trainer', $t1Id, ['action' => 'dates', 'started_at' => $day(-40), 'expires_at' => $day(-9)]);
$l = limits($t1);
check($l['usage']['active'] === 3 && $l['usage']['suspended'] === 5, '8 athletes: 3 active, 5 suspended', $l['usage']);
$rows = $pdo->prepare('SELECT athlete_id, suspended_by_plan FROM trainer_athletes WHERE trainer_id = :t');
$rows->execute(['t' => $t1Id]);
$state = array_column($rows->fetchAll(), 'suspended_by_plan', 'athlete_id');
$suspended = (string) array_search(1, array_map('intval', $state), true);
$active = (string) array_search(0, array_map('intval', $state), true);
[$status, $data] = call('PATCH', "/athletes/{$suspended}/nutrition-goal", ['daily_calorie_goal' => 2000], $t1);
check($status === 403 && str_contains(json_encode($data), 'athlete_suspended_by_plan'), 'a suspended athlete is read-only for the trainer', [$status, $data]);
[$status] = call('GET', "/athletes/{$suspended}", null, $t1);
check($status === 200, 'but still readable');
[$status] = call('POST', '/messages', ['recipient_id' => $suspended, 'body' => 'سلام'], $t1);
check($status === 403, 'no message to the suspended athlete');
[$status] = call('POST', '/messages', ['recipient_id' => $active, 'body' => 'سلام'], $t1);
check($status === 201 || $status === 200, 'messages to an active athlete still work', $status);
[$status] = call('POST', '/trainer-billing/athletes', ['keep' => [$suspended]], $t1);
$keep = $pdo->prepare('SELECT suspended_by_plan FROM trainer_athletes WHERE trainer_id = :t AND athlete_id = :a');
$keep->execute(['t' => $t1Id, 'a' => $suspended]);
check($status === 200 && (int) $keep->fetchColumn() === 0 && limits($t1)['usage']['suspended'] === 5, 'the trainer picks who stays active', $status);
[$status, $data] = invite($t1);
check($status === 402, 'no new invite above the free cap');
admin('trainer', $t1Id, ['action' => 'extend', 'days' => 30]);
$l = limits($t1);
check($l['usage']['suspended'] === 0 && $l['usage']['active'] === 8 && $l['status'] === 'active', 'renewal brings all 8 back', $l['usage']);

echo "\n7. A club trainer follows the club's limits\n";
[$t3, $t3Id] = account('trainer3', null);
[$status, $data] = call('POST', '/invitations/accept-club', ['code' => $trainerCodes[0]], $t3);
check($status === 200, 'trainer joins the club', $data);
admin('club', $clubId, ['action' => 'override', 'on' => true, 'max_members' => 5, 'max_trainers' => 3]);
$ok = 0;
for ($i = 0; $i < 5; $i++) {
    $ok += invite($t3)[0] === 201 ? 1 : 0;
}
check($ok === 5, '5 invites go through: the club allows 5, more than the free trainer cap of 3', $ok);
[$status, $data] = invite($t3);
check($status === 409, 'the sixth is refused by the club cap', [$status, $data]);
$inv = $pdo->prepare('SELECT COUNT(*) FROM invitations WHERE trainer_id = :t AND club_id = :c');
$inv->execute(['t' => $t3Id, 'c' => $clubId]);
check((int) $inv->fetchColumn() === 5, 'the invites carry the club');

echo "\nAccepting an invite re-checks the cap\n";
[$t4, $t4Id] = account('trainer4', 'trainer');
$codes = [invite($t4)[1]['code'], invite($t4)[1]['code']];
admin('trainer', $t4Id, ['action' => 'override', 'on' => true, 'max_athletes' => 1]);
[$status] = accept($codes[0], 'athlete4-1');
check($status === 200, 'first accept fits the cap of 1');
[$status, $data] = accept($codes[1], 'athlete4-2');
check($status === 409, 'second accept is refused', [$status, $data]);
$notice = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE recipient_id = :t AND title = 'دعوت پذیرفته نشد'");
$notice->execute(['t' => $t4Id]);
$revoked = $pdo->prepare("SELECT status FROM invitations WHERE code = :c");
$revoked->execute(['c' => $codes[1]]);
check((int) $notice->fetchColumn() === 1 && $revoked->fetchColumn() === 'revoked', 'the invite is revoked and the trainer told');

echo "\nAdmin protections and history\n";
[$status] = call('PATCH', '/admin/trainer-plans/' . $tPlan['رایگان'], ['is_active' => false], $adminToken);
check($status === 409, 'the free plan cannot be switched off');
[, $plansData] = call('GET', '/trainer-billing', null, $t1);
check(!in_array('رایگان', array_column($plansData['plans'] ?? [], 'name'), true), 'the free plan is not on sale');
[$status, $data] = call('GET', "/admin/plan-accounts/trainer/{$t1Id}", null, $adminToken);
$actions = array_column($data['history'] ?? [], 'action');
check(in_array('trainer_payment_approved', $actions, true) && in_array('plan_dates', $actions, true) && in_array('plan_extend', $actions, true), 'history has the payment, the dates and the extension', $actions);
[$status, $data] = call('GET', '/admin/plan-accounts', null, $adminToken);
check($status === 200 && count($data['trainers'] ?? []) >= 4 && count($data['clubs'] ?? []) >= 1, 'the admin list has trainers and clubs');
[$status] = admin('trainer', $t2Id, ['action' => 'reactivate']);
check($status === 200, 'reactivate runs');

// ---- Phase 2: custom exercises and templates ----------------------------

function exercise(string $token, string $name): array
{
    return call('POST', '/library/exercises', ['name' => $name, 'muscle_group' => 'chest'], $token);
}

function template(string $token, string $title, ?string $source = null): array
{
    return call('POST', '/plans/workout/templates', ['title' => $title] + ($source ? ['source_id' => $source] : []), $token);
}

function content(string $token): array
{
    return limits($token)['content'] ?? [];
}

echo "\nPhase 2: a free trainer has 5 custom exercises and no templates\n";
[$c1, $c1Id] = account('content1', 'trainer');
$ok = 0;
for ($i = 1; $i <= 5; $i++) {
    $ok += exercise($c1, "حرکت {$i}")[0] === 201 ? 1 : 0;
}
check($ok === 5, 'exercises 1 to 5 are made', $ok);
[$status, $data] = exercise($c1, 'حرکت ۶');
check($status === 402 && ($data['error']['code'] ?? '') === 'exercise_limit', 'the sixth is refused (402 exercise_limit)', [$status, $data]);
[$status, $data] = template($c1, 'قالب');
check($status === 402 && ($data['error']['code'] ?? '') === 'template_limit', 'no template on the free plan (402 template_limit)', [$status, $data]);
check(str_contains($data['error']['message'] ?? '', 'نقره‌ای'), 'the message names the cheapest plan with templates', $data);
$c = content($c1);
check(($c['exercises']['used'] ?? 0) === 5 && ($c['exercises']['max'] ?? 0) === 5 && ($c['templates']['max'] ?? 1) === 0, 'usage shows 5 of 5 and 0 templates', $c);

echo "\nDeleting frees a place; one used in a plan can't be deleted\n";
$ids = $pdo->prepare('SELECT id FROM exercises WHERE created_by = :t ORDER BY created_at');
$ids->execute(['t' => $c1Id]);
$own = $ids->fetchAll(PDO::FETCH_COLUMN);
[$status] = call('PATCH', "/library/exercises/{$own[0]}", ['name' => 'حرکت ویرایش‌شده'], $c1);
check($status === 200, 'the trainer edits their own exercise');
[$status] = call('DELETE', "/library/exercises/{$own[1]}", null, $c1);
check($status === 200, 'and deletes an unused one');
[$status] = exercise($c1, 'حرکت جایگزین');
check($status === 201, 'which frees the place for a new one');
[$otherToken] = account('content-other', 'trainer');
[$status] = call('DELETE', "/library/exercises/{$own[2]}", null, $otherToken);
check($status === 404, "another trainer can't delete it");

echo "\nAfter a silver payment: 30 exercises and 5 templates\n";
[$status, $data] = call('POST', '/trainer-billing/requests', ['plan_id' => $tPlan['نقره‌ای'], 'tracking_code' => 'CNT' . $run, 'card_last4' => '4321'], $c1);
call('POST', '/admin/trainer-billing/requests/' . ($data['id'] ?? '') . '/approve', [], $adminToken);
$ok = 0;
for ($i = 6; $i <= 30; $i++) {
    $ok += exercise($c1, "حرکت {$i}")[0] === 201 ? 1 : 0;
}
check($ok === 25, 'exercises 6 to 30 are made', $ok);
check(exercise($c1, 'حرکت ۳۱')[0] === 402, 'the 31st is refused');
$templates = [];
for ($i = 1; $i <= 5; $i++) {
    [$status, $data] = template($c1, "قالب {$i}");
    if ($status === 201) {
        $templates[] = $data['id'];
    }
}
check(count($templates) === 5, 'templates 1 to 5 are made', count($templates));
check(template($c1, 'قالب ۶')[0] === 402, 'the sixth is refused');
check(template($c1, 'کپی قالب', $templates[0])[0] === 402, 'copying a template counts too');

// Save a plan as a template: the plan needs an athlete.
[$status, $data] = invite($c1);
[, , $athlete] = accept($data['code'], 'content-athlete');
[$status, $plan] = call('POST', '/plans/workout', ['title' => 'برنامه', 'athlete_id' => $athlete], $c1);
check(template($c1, 'از روی برنامه', $plan['id'] ?? null)[0] === 402, 'saving a plan as a template counts too');
[, $planDay] = call('POST', "/plans/workout/{$plan['id']}/days", ['day_number' => 1], $c1);
call('POST', "/plans/workout/{$plan['id']}/days/{$planDay['id']}/exercises", ['exercise_id' => $own[2]], $c1);
[$status, $data] = call('DELETE', "/library/exercises/{$own[2]}", null, $c1);
check($status === 409 && ($data['error']['code'] ?? '') === 'in_use', 'an exercise used in a plan is not deleted', [$status, $data]);

// The content library: a public template the admin offers.
$public = '7e000000-0000-4000-8000-' . substr(str_pad($run, 12, '0', STR_PAD_LEFT), -12);
$pdo->prepare("INSERT INTO workout_assignments (id, trainer_id, title, is_template, is_public) VALUES (:id, :t, 'قالب عمومی', 1, 1)")
    ->execute(['id' => $public, 't' => $adminId]);
[$status, $data] = call('POST', "/content-library/workout/{$public}/copy", null, $c1);
check($status === 402, 'copying from the content library counts too', [$status, $data]);
[$status] = call('DELETE', "/plans/workout/templates/{$templates[4]}", null, $c1);
check($status === 200 && template($c1, 'قالب جایگزین')[0] === 201, 'deleting a template frees a place');

echo "\nGold: exercises unlimited, 20 templates; diamond: both unlimited\n";
admin('trainer', $c1Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'expires_at' => $day(30)]);
check(exercise($c1, 'حرکت طلایی')[0] === 201, 'gold: a 31st exercise is made');
$ok = 0;
for ($i = 6; $i <= 20; $i++) {
    $ok += template($c1, "قالب {$i}")[0] === 201 ? 1 : 0;
}
check($ok === 15, 'gold: templates up to 20', $ok);
check(template($c1, 'قالب ۲۱')[0] === 402, 'gold: the 21st template is refused');
admin('trainer', $c1Id, ['action' => 'activate', 'plan_id' => $tPlan['الماسی'], 'expires_at' => $day(30)]);
check(template($c1, 'قالب ۲۱')[0] === 201, 'diamond: templates unlimited');

echo "\nAfter the paid plan and its grace days end: what's there stays, nothing new\n";
admin('trainer', $c1Id, ['action' => 'dates', 'started_at' => $day(-40), 'expires_at' => $day(-10)]);
$c = content($c1);
check(($c['exercises']['used'] ?? 0) === 31 && ($c['exercises']['over'] ?? false) && ($c['templates']['over'] ?? false), 'back on free: 31 exercises and 21 templates, both above the cap', $c);
[, $picker] = call('GET', '/library/exercises/picker', null, $c1);
$mine = array_filter($picker['items'] ?? [], fn ($e) => ($e['created_by'] ?? null) === $c1Id);
check(count($mine) === 31, 'all 31 are still in the picker', count($mine));
check(exercise($c1, 'حرکت تازه')[0] === 402, 'but a new one is refused');
[$status] = call('PATCH', "/library/exercises/{$own[0]}", ['description' => 'هنوز قابل ویرایش'], $c1);
check($status === 200, 'and the old ones can still be edited');
[, $accounts] = call('GET', '/admin/plan-accounts', null, $adminToken);
$row = array_values(array_filter($accounts['trainers'] ?? [], fn ($t) => $t['id'] === $c1Id))[0] ?? null;
check(($row['limits']['over_cap'] ?? false) && ($row['limits']['content']['templates']['used'] ?? 0) === 21, 'the admin list shows usage and "over cap"', $row['limits']['content'] ?? null);

echo "\nConcurrent requests can't pass the cap\n";
[$c2, $c2Id] = account('content2', 'trainer');
for ($i = 1; $i <= 4; $i++) {
    exercise($c2, "حرکت {$i}");
}
$mh = curl_multi_init();
$handles = [];
for ($i = 0; $i < 6; $i++) {
    $ch = curl_init($api . '/library/exercises');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $c2],
        CURLOPT_POSTFIELDS => json_encode(['name' => "هم‌زمان {$i}", 'muscle_group' => 'back']),
    ]);
    curl_multi_add_handle($mh, $ch);
    $handles[] = $ch;
}
do {
    curl_multi_exec($mh, $running);
    curl_multi_select($mh);
} while ($running > 0);
$codes = array_map(fn ($ch) => curl_getinfo($ch, CURLINFO_HTTP_CODE), $handles);
$count = $pdo->prepare('SELECT COUNT(*) FROM exercises WHERE created_by = :t');
$count->execute(['t' => $c2Id]);
check((int) $count->fetchColumn() === 5 && count(array_filter($codes, fn ($c) => $c === 201)) === 1, 'six at once for the last place: exactly one is made', $codes);

echo "\nA club trainer has no cap while the club's plan runs\n";
[$c3, $c3Id] = account('content3', null);
[$status] = call('POST', '/invitations/accept-club', ['code' => $trainerCodes[1]], $c3);
check($status === 200, 'trainer joins the club (silver, running)');
check(template($c3, 'قالب باشگاهی')[0] === 201, 'a template on the free personal plan: allowed through the club');
$ok = 0;
for ($i = 1; $i <= 6; $i++) {
    $ok += exercise($c3, "حرکت باشگاهی {$i}")[0] === 201 ? 1 : 0;
}
check($ok === 6, 'and more than 5 exercises', $ok);
admin('club', $clubId, ['action' => 'dates', 'started_at' => $day(-40), 'expires_at' => $day(-10)]);
check(template($c3, 'قالب بعد از انقضا')[0] === 402, "once the club's plan has ended, the trainer's own plan applies");

echo "\nWith enforcement off, no cap at all\n";
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => false, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
check(exercise($c2, 'بدون محدودیت')[0] === 201 && template($c2, 'بدون محدودیت')[0] === 201, 'a free trainer makes a 6th exercise and a template');
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => true, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);

// ---- Phase 3: plan history ------------------------------------------------

/** A workout plan for $athlete, then aged to $months ago with $status. */
function agedPlan(string $token, string $athlete, string $title, float $months, string $status): string
{
    global $pdo;
    [, $plan] = call('POST', '/plans/workout', ['title' => $title, 'athlete_id' => $athlete], $token);
    $pdo->prepare('UPDATE workout_assignments SET status = :s, assigned_at = :at WHERE id = :id')->execute([
        's' => $status, 'at' => date('Y-m-d H:i:s', (int) strtotime('-' . (int) round($months * 30) . ' days')), 'id' => $plan['id'],
    ]);
    return $plan['id'];
}

/** Titles of the trainer's plans for this athlete, and the hidden summary. */
function planList(string $token, string $athlete): array
{
    [, $data] = call('GET', "/plans/workout?athlete_id={$athlete}", null, $token);
    return [array_column($data['items'] ?? [], 'title'), $data['hidden'] ?? null];
}

echo "\nPhase 3: a free trainer sees 3 months of finished plans\n";
[$h1, $h1Id] = account('history1', 'trainer');
[, $inv] = invite($h1);
[, , $hAthlete, $hAthleteToken] = accept($inv['code'], 'history-athlete');
$p2 = agedPlan($h1, $hAthlete, 'دوماهه', 2, 'completed');
$p4 = agedPlan($h1, $hAthlete, 'چهارماهه', 4, 'completed');
$p6 = agedPlan($h1, $hAthlete, 'فعلی ششماهه', 6, 'active');
$p11 = agedPlan($h1, $hAthlete, 'یازده‌ماهه', 11, 'cancelled');
$p13 = agedPlan($h1, $hAthlete, 'سیزده‌ماهه', 13, 'completed');
[$titles, $hidden] = planList($h1, $hAthlete);
check(in_array('دوماهه', $titles, true) && !in_array('چهارماهه', $titles, true), 'the 2-month plan shows, the 4-month one does not', $titles);
check(in_array('فعلی ششماهه', $titles, true), "an athlete's current plan made 6 months ago still shows");
check(($hidden['count'] ?? 0) === 3 && ($hidden['months'] ?? 0) === 3, 'the list says 3 plans are hidden, beyond 3 months', $hidden);
[$status, $data] = call('GET', "/plans/workout/{$p4}", null, $h1);
check($status === 403 && ($data['error']['code'] ?? '') === 'history_hidden', 'opening a hidden plan by id is refused with the upgrade message', [$status, $data]);
check(call('GET', "/plans/workout/{$p4}/days", null, $h1)[0] === 403, 'and so is its structure');
check(call('POST', '/plans/workout', ['id' => $p4, 'title' => 'ویرایش'], $h1)[0] === 403, 'and editing it');
[, $conv] = call('GET', "/messages/conversation/{$hAthlete}", null, $h1);
$convIds = array_column($conv['plans'] ?? [], 'id');
check(!in_array($p4, $convIds, true) && in_array($p2, $convIds, true), 'and the plans offered in messages');
check(call('GET', "/plans/workout/{$p4}/comments", null, $h1)[0] === 403, "and the hidden plan's comment thread");

echo "\nThe athlete always sees their whole history\n";
[, $mine] = call('GET', '/plans/workout/mine', null, $hAthleteToken);
check(count(array_intersect([$p2, $p4, $p6, $p11, $p13], array_column($mine['items'] ?? [], 'id'))) === 5, 'all five plans', array_column($mine['items'] ?? [], 'title'));
check(call('GET', "/plans/workout/{$p4}", null, $hAthleteToken)[0] === 200, 'and can open the old one');

echo "\nSilver: 12 months; gold and diamond: all\n";
[$status, $data] = call('POST', '/trainer-billing/requests', ['plan_id' => $tPlan['نقره‌ای'], 'tracking_code' => 'HIS' . $run, 'card_last4' => '1111'], $h1);
call('POST', '/admin/trainer-billing/requests/' . ($data['id'] ?? '') . '/approve', [], $adminToken);
[$titles, $hidden] = planList($h1, $hAthlete);
check(in_array('یازده‌ماهه', $titles, true) && !in_array('سیزده‌ماهه', $titles, true), 'silver: the 11-month plan shows, the 13-month one does not', $titles);
check(($hidden['count'] ?? 0) === 1 && ($hidden['months'] ?? 0) === 12, 'one hidden, beyond 12 months', $hidden);
// The completed-plans list is a report (phase 4: basic), so it is checked on silver.
[, $comp] = call('GET', "/athletes/{$hAthlete}/completed-plans", null, $h1);
check(!in_array('سیزده‌ماهه', array_column($comp['items'] ?? [], 'title'), true) && in_array('دوماهه', array_column($comp['items'] ?? [], 'title'), true), 'the completed-plans list hides it too', array_column($comp['items'] ?? [], 'title'));
check(call('GET', "/plans/workout/{$p4}", null, $h1)[0] === 200, 'right after the payment, the 4-month plan opens again');
admin('trainer', $h1Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'expires_at' => $day(30)]);
[$titles, $hidden] = planList($h1, $hAthlete);
check(count($titles) === 5 && $hidden === null, 'gold: all five, nothing hidden', [$titles, $hidden]);
admin('trainer', $h1Id, ['action' => 'activate', 'plan_id' => $tPlan['الماسی'], 'expires_at' => $day(30)]);
check(count(planList($h1, $hAthlete)[0]) === 5, 'diamond: all five');

echo "\nGrace days: still the paid plan's history; after them, the free plan's\n";
admin('trainer', $h1Id, ['action' => 'activate', 'plan_id' => $tPlan['نقره‌ای'], 'started_at' => $day(-40), 'expires_at' => $day(-1)]);
check(in_array('چهارماهه', planList($h1, $hAthlete)[0], true), 'in the grace days: the 4-month plan still shows');
admin('trainer', $h1Id, ['action' => 'dates', 'started_at' => $day(-40), 'expires_at' => $day(-8)]);
check(!in_array('چهارماهه', planList($h1, $hAthlete)[0], true), 'after them: back to 3 months');
admin('trainer', $h1Id, ['action' => 'extend', 'days' => 30]);
check(in_array('چهارماهه', planList($h1, $hAthlete)[0], true), 'a renewal brings it back at once');
$left = $pdo->prepare('SELECT COUNT(*) FROM workout_assignments WHERE trainer_id = :t');
$left->execute(['t' => $h1Id]);
check((int) $left->fetchColumn() === 5, 'nothing was deleted');

echo "\nAdmin list, enforcement off, club trainers\n";
admin('trainer', $h1Id, ['action' => 'dates', 'started_at' => $day(-60), 'expires_at' => $day(-20)]);
[, $accounts] = call('GET', '/admin/plan-accounts', null, $adminToken);
$row = array_values(array_filter($accounts['trainers'] ?? [], fn ($t) => $t['id'] === $h1Id))[0] ?? null;
check(($row['limits']['history']['hidden'] ?? 0) === 3, 'the admin list shows 3 hidden plans for the trainer', $row['limits']['history'] ?? null);
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => false, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
check(count(planList($h1, $hAthlete)[0]) === 5, 'with enforcement off, nothing is hidden');
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => true, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
admin('club', $clubId, ['action' => 'activate', 'plan_id' => $cPlan['نقره‌ای'], 'expires_at' => $day(30)]);
[, $inv] = invite($c3);
[, , $clubAthlete] = accept($inv['code'], 'history-club-athlete');
agedPlan($c3, $clubAthlete, 'قدیمی باشگاهی', 20, 'completed');
check(in_array('قدیمی باشگاهی', planList($c3, $clubAthlete)[0], true), "a club trainer sees all (the club's plan runs)");

// ---- Phase 4: report levels -----------------------------------------------

/** Status and error code of each report section, for this trainer. */
function reports(string $token, string $athlete): array
{
    $out = [];
    foreach ([
        'completion' => '/reports/trainer/completion-rates',
        'progress'   => '/reports/trainer/athlete-progress',
        'completed'  => "/athletes/{$athlete}/completed-plans",
        'adherence'  => '/reports/trainer/weekly-adherence',
    ] as $key => $path) {
        [$status, $data] = call('GET', $path, null, $token);
        $out[$key] = $status === 200 ? 200 : $status . ':' . ($data['error']['code'] ?? '');
    }
    return $out;
}

/** The sheets of an .xlsx (name => XML), or null when it isn't one. */
function sheetsOf(string $raw): ?array
{
    $path = tempnam(sys_get_temp_dir(), 'xlsx');
    file_put_contents($path, $raw);
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        unlink($path);
        return null;
    }
    preg_match_all('/<sheet name="([^"]+)"/', (string) $zip->getFromName('xl/workbook.xml'), $names);
    $sheets = [];
    foreach ($names[1] as $i => $name) {
        $sheets[html_entity_decode($name)] = (string) $zip->getFromName('xl/worksheets/sheet' . ($i + 1) . '.xml');
    }
    $zip->close();
    unlink($path);
    return $sheets;
}

/** [status, error code or null, the xlsx's sheets (name => XML) or null] of the Excel report. */
function excel(string $token): array
{
    [$status, $data] = call('GET', '/reports/trainer/excel', null, $token);
    if ($status !== 200) {
        return [$status, $data['error']['code'] ?? null, null];
    }
    $sheets = sheetsOf($data['raw'] ?? '');
    return [$status, $sheets === null ? 'not_a_zip' : null, $sheets];
}

/** How many report_excel_export entries the trainer has in the activity log. */
function excelLogs(string $trainerId): int
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM activity_logs WHERE action = 'report_excel_export' AND actor_id = :t AND subject_id = :s");
    $stmt->execute(['t' => $trainerId, 's' => $trainerId]);
    return (int) $stmt->fetchColumn();
}

echo "\nPhase 4: a free trainer gets the counts only\n";
[$r1, $r1Id] = account('reports1', 'trainer');
[, $inv] = invite($r1);
[, , $rAthlete, $rAthleteToken] = accept($inv['code'], 'reports-athlete');
call('POST', '/plans/workout', ['title' => 'برنامهٔ گزارش', 'athlete_id' => $rAthlete], $r1);
check((limits($r1)['reports']['effective'] ?? null) === 'count', 'the trainer\'s report level is count', limits($r1)['reports'] ?? null);
[$status, $monthly] = call('GET', '/reports/trainer/monthly-stats', null, $r1);
check($status === 200 && $monthly['athletes_count'] === 1 && $monthly['workout_plans_this_month'] === null
    && $monthly['nutrition_plans_this_month'] === null && $monthly['locked'] === true,
    'monthly stats: the athlete count, and no plan counts', $monthly);
$locked = reports($r1, $rAthlete);
check($locked === ['completion' => '402:report_locked', 'progress' => '402:report_locked', 'completed' => '402:report_locked', 'adherence' => '402:report_locked'],
    'completion rates, athlete progress and weekly adherence are refused by the server', $locked);
[, $err] = call('GET', '/reports/trainer/weekly-adherence', null, $r1);
check(str_contains($err['error']['message'] ?? '', 'طلایی'), 'the message names the plan that opens it', $err);
[$status, $dash] = call('GET', '/dashboard/trainer', null, $r1);
check($status === 200 && ($dash['statistics']['athletes_count'] ?? null) === 1 && ($dash['statistics']['active_workout_count'] ?? null) === 1,
    'the dashboard counts stay open', $dash['statistics'] ?? null);
[$status, $code] = excel($r1);
check($status === 402 && $code === 'report_locked', 'the Excel report is refused (402)', [$status, $code]);
check(excelLogs($r1Id) === 0, 'and a refused one is not logged');

echo "\nNever locked: progress, «درآمد من», streaks, birthdays, the athlete's own view\n";
check(call('GET', "/athletes/{$rAthlete}/measurements", null, $r1)[0] === 200, 'progress measurements');
check(call('POST', "/athletes/{$rAthlete}/measurements", ['measured_at' => date('Y-m-d'), 'weight_kg' => 70], $r1)[0] === 201, 'recording a measurement');
check(call('GET', '/earnings', null, $r1)[0] === 200, 'earnings');
check(call('GET', '/reports/financial-summary?from=' . $day(-365) . '&to=' . $day(0), null, $r1)[0] === 200, 'the monthly earnings summary and 12-month trend');
check(call('GET', "/workout-day-logs?from={$day(-84)}&athlete_ids={$rAthlete}", null, $r1)[0] === 200, 'the training logs streaks are counted from');
[$status, $roster] = call('GET', '/athletes', null, $r1);
check($status === 200 && array_key_exists('birth_date', ($roster['items'] ?? [[]])[0] ?? []), 'the roster with birth dates (birthday reminder)', $roster['items'][0] ?? $roster);
check(call('GET', "/athletes/{$rAthlete}/completed-plans", null, $rAthleteToken)[0] === 200, "the athlete's own completed plans");

echo "\nSilver: basic; gold: full; diamond: full_excel\n";
admin('trainer', $r1Id, ['action' => 'activate', 'plan_id' => $tPlan['نقره‌ای'], 'expires_at' => $day(30)]);
[, $monthly] = call('GET', '/reports/trainer/monthly-stats', null, $r1);
check($monthly['workout_plans_this_month'] === 1 && $monthly['locked'] === false, 'silver: monthly stats open', $monthly);
$silver = reports($r1, $rAthlete);
check($silver === ['completion' => 200, 'progress' => 200, 'completed' => 200, 'adherence' => '402:report_locked'], 'silver: completion rates open, weekly adherence locked', $silver);
admin('trainer', $r1Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'expires_at' => $day(30)]);
check(!in_array(false, array_map(fn ($v) => $v === 200, reports($r1, $rAthlete)), true), 'gold: every section open');
check((limits($r1)['reports']['effective'] ?? null) === 'full', 'gold: level full');
check(excel($r1)[0] === 402, 'gold: the Excel report is refused (402)');
admin('trainer', $r1Id, ['action' => 'activate', 'plan_id' => $tPlan['الماسی'], 'expires_at' => $day(30)]);
check((limits($r1)['reports']['effective'] ?? null) === 'full_excel', 'diamond: level full_excel');

echo "\nThe Excel report (diamond)\n";
// A finished plan, a tick this week, and another trainer's athlete who must not appear.
[, $done] = call('POST', '/plans/workout', ['title' => 'تمام‌شده', 'athlete_id' => $rAthlete, 'description' => "شنبه:\nاسکوات\nدوشنبه — سینه:\nپرس\nچهارشنبه:\nددلیفت"], $r1);
$pdo->prepare("UPDATE workout_assignments SET status = 'completed' WHERE id = :id")->execute(['id' => $done['id']]);
// The athlete's most recent active plan is the one measured; made in the same second, the two would tie.
$pdo->prepare('UPDATE workout_assignments SET assigned_at = assigned_at - INTERVAL 1 MINUTE WHERE trainer_id = :t')->execute(['t' => $r1Id]);
[, $active] = call('POST', '/plans/workout', ['title' => 'برنامهٔ فعال', 'athlete_id' => $rAthlete, 'description' => "شنبه:\nاسکوات\nیکشنبه:\nپرس\nسه‌شنبه:\nددلیفت\nپنجشنبه:\nبارفیکس"], $r1);
call('POST', '/workout-day-logs', ['assignment_id' => $active['id'], 'day_key' => 'شنبه', 'completed_on' => date('Y-m-d')], $rAthleteToken);
[$other] = account('reports-other', 'trainer');
[, $inv] = invite($other);
accept($inv['code'], 'stranger-athlete');
[$status, , $sheets] = excel($r1);
check($status === 200 && $sheets !== null && array_keys($sheets) === ['آمار ماهانه', 'نرخ تکمیل', 'پایبندی هفتگی'], 'diamond: an .xlsx with the three sheets', [$status, $sheets === null ? null : array_keys($sheets)]);
$all = implode('', $sheets ?? []);
check(substr_count($all, 'rightToLeft="1"') === 3, 'every sheet is right-to-left');
check(str_contains($sheets['آمار ماهانه'] ?? '', 'برنامه‌ی تمرینی') && str_contains($sheets['آمار ماهانه'] ?? '', \Gymlic\Jalali::monthLabel(\Gymlic\Jalali::monthStart())),
    'Persian column names and Jalali months');
check(str_contains($all, 'reports-athlete') && !str_contains($all, 'stranger-athlete'), "only the trainer's own athletes");
preg_match('/<row r="3">(.*?)<\/row>/', $sheets['نرخ تکمیل'] ?? '', $m);
check(str_contains($m[1] ?? '', 'reports-athlete') && preg_match('/<c r="B3"><v>1<\/v><\/c><c r="C3"><v>3<\/v>/', $m[1] ?? '') === 1,
    'completion: 1 of 3 workout plans for the athlete', $m[1] ?? null);
preg_match('/<row r="2">(.*?)<\/row>/', $sheets['پایبندی هفتگی'] ?? '', $m);
check(preg_match('/<c r="C2"><v>4<\/v><\/c><c r="D2"><v>1<\/v><\/c><c r="E2"><v>25<\/v>/', $m[1] ?? '') === 1,
    'adherence: 1 of 4 sessions this week, 25%', $m[1] ?? null);
check(excelLogs($r1Id) === 1, 'the download is in the activity log');
[, $hist] = call('GET', "/admin/plan-accounts/trainer/{$r1Id}", null, $adminToken);
check(in_array('report_excel_export', array_column($hist['history'] ?? [], 'action'), true), "and in the trainer's history in the admin panel");

echo "\nGrace days keep the paid level; from day 8, count; a renewal restores it\n";
admin('trainer', $r1Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'started_at' => $day(-40), 'expires_at' => $day(-1)]);
check(reports($r1, $rAthlete)['adherence'] === 200, 'in the grace days: weekly adherence still open');
admin('trainer', $r1Id, ['action' => 'dates', 'started_at' => $day(-40), 'expires_at' => $day(-8)]);
check(reports($r1, $rAthlete)['adherence'] === '402:report_locked' && (limits($r1)['reports']['effective'] ?? null) === 'count', 'after them: count');
admin('trainer', $r1Id, ['action' => 'extend', 'days' => 30]);
check(reports($r1, $rAthlete)['adherence'] === 200, 'a renewal opens it again at once');

echo "\nAdmin list, enforcement off, club trainers, plan validation\n";
admin('trainer', $r1Id, ['action' => 'dates', 'started_at' => $day(-60), 'expires_at' => $day(-20)]);
[, $accounts] = call('GET', '/admin/plan-accounts', null, $adminToken);
$row = array_values(array_filter($accounts['trainers'] ?? [], fn ($t) => $t['id'] === $r1Id))[0] ?? null;
check(($row['limits']['reports']['effective'] ?? null) === 'count', 'the admin list shows the trainer\'s report level', $row['limits']['reports'] ?? null);
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => false, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
$off = reports($r1, $rAthlete);
check(!in_array(false, array_map(fn ($v) => $v === 200, $off), true) && call('GET', '/reports/trainer/monthly-stats', null, $r1)[1]['locked'] === false
    && excel($r1)[0] === 200, 'with enforcement off, nothing is locked, the Excel report included', $off);
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => true, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
check(reports($c3, $clubAthlete)['adherence'] === 200, "a club trainer on the free plan sees everything (the club's plan runs)");
[$status, $inv] = invite($t3);
check($status === 201, 'another trainer of the same club adds an athlete', [$status, $inv]);
accept($inv['code'] ?? '', 'club-colleague-athlete');
[$status, , $sheets] = excel($c3);
$all = implode('', $sheets ?? []);
check($status === 200 && str_contains($all, 'history-club-athlete') && !str_contains($all, 'club-colleague-athlete'),
    "a club trainer's Excel report has only their own athletes, not the club's", $status);
[$status] = call('PATCH', '/admin/trainer-plans/' . $tPlan['طلایی'], ['report_level' => 'everything'], $adminToken);
check($status === 400, 'an invalid report level is refused on a trainer plan', $status);
[$status] = call('PATCH', '/admin/plans/' . $cPlan['طلایی'], ['report_level' => 'everything'], $adminToken);
check($status === 400, 'and on a club plan', $status);
$lvl = $pdo->prepare('SELECT report_level FROM trainer_plans WHERE id = :id');
$lvl->execute(['id' => $tPlan['طلایی']]);
check($lvl->fetchColumn() === 'full', 'the plan keeps its level');

// ---- Phase 5: the trainer's full data export ------------------------------

/**
 * [status, error code, sheets] of «دریافت همه‌ی اطلاعات». Unless $keepLimit,
 * the export is then dated 11 minutes back, so the next check isn't held up
 * by the one-per-10-minutes limit.
 */
function dataExport(string $token, string $trainerId, bool $keepLimit = false): array
{
    global $pdo;
    [$status, $data] = call('GET', '/trainer/data-export', null, $token);
    if (!$keepLimit) {
        $pdo->prepare("UPDATE activity_logs SET created_at = created_at - INTERVAL 11 MINUTE WHERE actor_id = :t AND action = 'trainer_data_export'")
            ->execute(['t' => $trainerId]);
    }
    if ($status !== 200) {
        return [$status, $data['error']['code'] ?? null, null];
    }
    $sheets = sheetsOf($data['raw'] ?? '');
    return [$status, $sheets === null ? 'not_a_zip' : null, $sheets];
}

/** The text of a sheet's cells, for "contains" checks. */
function sheetText(?array $sheets, string $name): string
{
    return html_entity_decode(strip_tags(str_replace('</c>', ' | ', $sheets[$name] ?? '')));
}

echo "\nPhase 5: a free trainer takes all of their data\n";
[$d1, $d1Id] = account('data1', 'trainer');
$dAthletes = [];
for ($i = 1; $i <= 3; $i++) {
    [, $inv] = invite($d1);
    [, , $id, $tok] = accept($inv['code'], "data-athlete{$i}");
    $dAthletes[] = [$id, $tok];
}
[$dAthlete, $dAthleteToken] = $dAthletes[0];
// One suspended by the plan, one by hand: both still in the file.
$pdo->prepare('UPDATE trainer_athletes SET suspended_by_plan = 1 WHERE trainer_id = :t AND athlete_id = :a')->execute(['t' => $d1Id, 'a' => $dAthletes[1][0]]);
$pdo->prepare("UPDATE trainer_athletes SET status = 'suspended' WHERE trainer_id = :t AND athlete_id = :a")->execute(['t' => $d1Id, 'a' => $dAthletes[2][0]]);
$dOld = agedPlan($d1, $dAthlete, 'برنامهٔ قدیمی پنهان', 8, 'completed');
[, $dPlan] = call('POST', '/plans/workout', ['title' => 'برنامهٔ جاری داده', 'athlete_id' => $dAthlete, 'description' => "شنبه:\nاسکوات"], $d1);
call('POST', "/plans/workout/{$dPlan['id']}/comments", ['body' => 'کامنت ورزشکار روی برنامه'], $dAthleteToken);
call('POST', "/athletes/{$dAthlete}/measurements", ['measured_at' => date('Y-m-d'), 'weight_kg' => 80, 'height_cm' => 180], $d1);
call('POST', '/earnings', ['athlete_id' => $dAthlete, 'amount_toman' => 750000, 'paid_at' => date('Y-m-d')], $d1);
exercise($d1, 'حرکت سفارشی داده');
$pdo->prepare("INSERT INTO athlete_discount_codes (id, trainer_id, code, kind, value) VALUES (UUID(), :t, :c, 'percent', 10)")
    ->execute(['t' => $d1Id, 'c' => 'SECRET' . strtoupper($run)]);
[$status, $dPayment] = call('POST', '/trainer-billing/requests', ['plan_id' => $tPlan['نقره‌ای'], 'tracking_code' => 'PAYDATA' . $run, 'card_last4' => '4321'], $d1);
check(!in_array('برنامهٔ قدیمی پنهان', planList($d1, $dAthlete)[0], true), 'the 8-month-old finished plan is hidden from the free trainer\'s list (phase 3)');

[$status, $code, $sheets] = dataExport($d1, $d1Id, true);
check($status === 200 && $sheets !== null, 'a free trainer gets the file', [$status, $code]);
[$status, $code] = dataExport($d1, $d1Id, true);
check($status === 429 && $code === 'export_too_soon', 'a second one within 10 minutes is refused', [$status, $code]);
$logs = $pdo->prepare("SELECT COUNT(*) FROM activity_logs WHERE action = 'trainer_data_export' AND actor_id = :t");
$logs->execute(['t' => $d1Id]);
check((int) $logs->fetchColumn() === 1, 'the export is in the activity log, the refused one is not');
[, $hist] = call('GET', "/admin/plan-accounts/trainer/{$d1Id}", null, $adminToken);
check(in_array('trainer_data_export', array_column($hist['history'] ?? [], 'action'), true), "and in the trainer's history in the admin panel");
$pdo->prepare("UPDATE activity_logs SET created_at = created_at - INTERVAL 11 MINUTE WHERE actor_id = :t AND action = 'trainer_data_export'")->execute(['t' => $d1Id]);

$athletesText = sheetText($sheets, 'ورزشکاران');
check(str_contains($athletesText, 'data-athlete2') && str_contains($athletesText, 'غیرفعال با پایان پلن')
    && str_contains($athletesText, 'data-athlete3') && str_contains($athletesText, 'معلق'),
    'athletes suspended by the plan and by hand are in it, with their status', $athletesText);
check(str_contains(sheetText($sheets, 'برنامه‌های تمرینی'), 'برنامهٔ قدیمی پنهان'), 'the plan the history limit hides is in it');
check(str_contains(sheetText($sheets, 'کامنت‌های برنامه‌ها'), 'کامنت ورزشکار روی برنامه'), 'plan comments');
$measure = sheetText($sheets, 'اندازه‌گیری‌ها');
check(str_contains($measure, '24.7'), 'measurements, with BMI worked out (80 kg, 180 cm → 24.7)', $measure);
check(str_contains(sheetText($sheets, 'درآمد من'), '750000'), 'earnings');
check(str_contains(sheetText($sheets, 'حرکت‌ها و موارد سفارشی'), 'حرکت سفارشی داده'), 'custom exercises');
$all = implode('', $sheets ?? []);
check(!str_contains($all, 'SECRET' . strtoupper($run)) && !str_contains($all, 'PAYDATA' . $run) && !str_contains($all, '4321'),
    'no discount codes and no platform subscription payments');
check(count($sheets ?? []) > 0 && substr_count($all, 'rightToLeft="1"') === count($sheets), 'every sheet is right-to-left');
check(isset($sheets['برنامه‌های تمرینی']) && str_contains(sheetText($sheets, 'برنامه‌های تمرینی'), \Gymlic\Jalali::format(date('Y-m-d'))),
    'Persian sheet names and Jalali dates', \Gymlic\Jalali::format(date('Y-m-d')));
check(!str_contains($all, 'reports-athlete') && !str_contains($all, 'history-athlete'), "no other trainer's athletes");

echo "\nThe same with enforcement off, in the grace days and after them\n";
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => false, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
[$status, , $off] = dataExport($d1, $d1Id);
check($status === 200 && array_keys($off ?? []) === array_keys($sheets ?? []) && sheetText($off, 'ورزشکاران') === $athletesText,
    'with enforcement off: the same file');
call('PUT', '/admin/settings/billing', ['value' => ['trainer_enforce' => true, 'grace_days' => 7, 'expiring_days' => 7, 'receipt_required' => false]], $adminToken);
admin('trainer', $d1Id, ['action' => 'activate', 'plan_id' => $tPlan['طلایی'], 'started_at' => $day(-40), 'expires_at' => $day(-1)]);
check((limits($d1)['status'] ?? null) === 'grace' && dataExport($d1, $d1Id)[0] === 200, 'in the grace days');
admin('trainer', $d1Id, ['action' => 'dates', 'started_at' => $day(-40), 'expires_at' => $day(-8)]);
check((limits($d1)['status'] ?? null) === 'expired' && dataExport($d1, $d1Id)[0] === 200, 'after them (expired)');

echo "\nAbove the caps, and in a club only one's own\n";
[$status, , $sheets] = dataExport($c2, $c2Id);
$custom = sheetText($sheets, 'حرکت‌ها و موارد سفارشی');
check($status === 200 && substr_count($custom, 'حرکت') >= 7 && str_contains($custom, 'بدون محدودیت')
    && str_contains(sheetText($sheets, 'قالب‌ها'), 'بدون محدودیت'),
    'a free trainer above the exercise and template caps gets all of them', $custom);
[$status, , $sheets] = dataExport($c3, $c3Id);
$all = implode('', $sheets ?? []);
check($status === 200 && str_contains($all, 'history-club-athlete') && !str_contains($all, 'club-colleague-athlete'),
    "a club trainer gets their own athletes, not the club's", $status);
[$athleteStatus] = call('GET', '/trainer/data-export', null, $dAthleteToken);
check($athleteStatus === 403, 'an athlete cannot use it', $athleteStatus);

echo "\n" . ($failures === 0 ? "All checks passed.\n" : "{$failures} check(s) failed.\n");
exit($failures === 0 ? 0 : 1);
