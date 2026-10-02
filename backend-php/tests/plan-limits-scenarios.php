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

echo "\n" . ($failures === 0 ? "All checks passed.\n" : "{$failures} check(s) failed.\n");
exit($failures === 0 ? 0 : 1);
