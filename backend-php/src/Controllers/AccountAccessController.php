<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AccountAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Features;
use Gymlic\Limits;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Tiers;
use Gymlic\Validate;
use PDO;

/**
 * /admin/account-access/{kind}/{id} (finance.plans): one trainer's or one
 * club's access set by hand (AccountAccess) — a fixed tier, sections on or
 * off one by one, and a trainer's content caps — beside what their plan
 * gives, so the screen can say "as the plan: open" for each.
 */
final class AccountAccessController
{
    /** GET: what is set, and what the plan gives without it. */
    public static function get(array $params): void
    {
        Auth::requireAdmin('finance.plans');
        $pdo = Database::connection();
        $kind = $params['kind'] ?? '';
        $account = self::account($pdo, $kind, $params['id'] ?? '');
        if ($account === null) {
            return;
        }

        $planTier = Tiers::fromPlan($pdo, $kind, $account['id']);
        $tiers = Settings::get('tiers');
        $planFeatures = [];
        foreach (array_keys(Features::CATALOG) as $key) {
            $planFeatures[$key] = Tiers::allows($planTier, $key);
        }

        $planLimits = null;
        if ($kind === 'trainer' && Limits::ready()) {
            $limits = Limits::forTrainer($pdo, $account['id']);
            $plan = $limits['plan'];
            $viaClub = (bool) ($limits['content']['via_club'] ?? false);
            $planLimits = [
                'max_custom_exercises' => $viaClub ? null : ($plan['max_custom_exercises'] ?? null),
                'max_templates'        => $viaClub ? null : ($plan['max_templates'] ?? null),
                'history_months'       => $viaClub ? null : ($plan['history_months'] ?? null),
                'report_level'         => $viaClub ? null : ($plan['report_level'] ?? null),
                'plan_name'            => $plan['name'] ?? null,
                'via_club'             => $viaClub,
            ];
        }

        Response::ok([
            'ready'         => AccountAccess::ready(),
            'tiers_ready'   => Tiers::ready(),
            'enforcing'     => Limits::enforcing(),
            'account'       => $account,
            'access'        => AccountAccess::get($pdo, $kind, $account['id']),
            'plan_tier'     => $planTier,
            'tier_labels'   => array_combine(Tiers::KEYS, array_map(static fn (string $t): string => $tiers[$t]['label'], Tiers::KEYS)),
            'plan_features' => $planFeatures,
            'plan_limits'   => $planLimits,
            'catalog'       => Features::catalog(),
        ]);
    }

    /** PUT {tier, features, limits, note}: replaces what is set; all empty = back to the plan. */
    public static function update(array $params): void
    {
        $admin = Auth::requireAdmin('finance.plans');
        if (!AccountAccess::ready()) {
            Response::error(409, 'not_ready', 'به‌روزرسانی «دسترسی اختصاصی هر مربی و باشگاه» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            return;
        }
        $pdo = Database::connection();
        $kind = $params['kind'] ?? '';
        $account = self::account($pdo, $kind, $params['id'] ?? '');
        if ($account === null) {
            return;
        }

        $data = Validate::body();
        $clean = AccountAccess::clean($kind, $data);
        if (is_string($clean)) {
            Response::error(400, 'invalid_access', $clean);
            return;
        }
        [$tier, $features, $limits] = $clean;
        $note = mb_substr(trim((string) ($data['note'] ?? '')), 0, 500) ?: null;

        $before = AccountAccess::get($pdo, $kind, $account['id']);
        AccountAccess::save($pdo, $kind, $account['id'], $tier, $features, $limits, $note, $admin['id']);

        AdminController::logActivity(
            $pdo,
            $kind === 'club' ? $account['id'] : null,
            $admin['id'],
            $kind === 'club' ? $account['owner_id'] : $account['id'],
            'account_access_set',
            [
                'kind'   => $kind,
                'name'   => $account['name'],
                'before' => $before === null ? null : array_intersect_key($before, array_flip(['tier', 'features', 'limits'])),
                'after'  => ['tier' => $tier, 'features' => $features, 'limits' => $limits],
                'note'   => $note,
            ]
        );

        Response::ok(['access' => AccountAccess::get($pdo, $kind, $account['id'])]);
    }

    /** @return array{id: string, name: string, owner_id: ?string}|null (answers 404 itself) */
    private static function account(PDO $pdo, string $kind, string $id): ?array
    {
        if (!isset(AccountAccess::KINDS[$kind])) {
            Response::error(404, 'not_found', 'نوع حساب معتبر نیست.');
            return null;
        }
        $stmt = $pdo->prepare(
            $kind === 'trainer'
                ? "SELECT id, TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS name, NULL AS owner_id
                   FROM profiles WHERE id = :id AND account_type = 'trainer'"
                : 'SELECT id, name, owner_id FROM clubs WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error(404, 'not_found', $kind === 'trainer' ? 'مربی پیدا نشد.' : 'باشگاه پیدا نشد.');
            return null;
        }
        return $row;
    }
}
