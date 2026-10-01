<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Features;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Tiers;
use Gymlic\TrainerBilling;
use Gymlic\Validate;

/**
 * /admin/tiers (finance): what each tier opens (saved as the "tiers"
 * settings group), and which tier each club plan and trainer plan is.
 */
final class TiersController
{
    public static function overview(): void
    {
        Auth::requireAdmin('finance');
        $pdo = Database::connection();
        $ready = Tiers::ready();

        $clubPlans = $pdo->query(
            'SELECT id, name, price_toman, duration_days, max_members, is_active' . ($ready ? ', tier' : ', NULL AS tier')
            . ' FROM plans ORDER BY price_toman'
        )->fetchAll();
        $trainerPlans = TrainerBilling::ready()
            ? $pdo->query(
                'SELECT id, name, price_toman, duration_days, max_athletes, is_active' . ($ready ? ', tier' : ', NULL AS tier')
                . ' FROM trainer_plans ORDER BY price_toman'
            )->fetchAll()
            : [];

        // Running subscriptions per tier ('' = no tier yet: not limited).
        $running = ['clubs' => [], 'trainers' => []];
        if ($ready) {
            foreach ($pdo->query(
                'SELECT COALESCE(s.tier, \'\') AS tier, COUNT(*) AS n FROM subscriptions s
                 WHERE s.expires_at > NOW()
                   AND s.expires_at = (SELECT MAX(s2.expires_at) FROM subscriptions s2 WHERE s2.club_id = s.club_id)
                 GROUP BY COALESCE(s.tier, \'\')'
            )->fetchAll() as $row) {
                $running['clubs'][$row['tier']] = (int) $row['n'];
            }
            foreach ($pdo->query(
                "SELECT COALESCE(tier, '') AS tier, COUNT(*) AS n FROM trainer_subscriptions WHERE expires_at > NOW() GROUP BY COALESCE(tier, '')"
            )->fetchAll() as $row) {
                $running['trainers'][$row['tier']] = (int) $row['n'];
            }
        }

        Response::ok([
            'ready'         => $ready,
            'trainer_ready' => TrainerBilling::ready(),
            'storage_ready' => Settings::storageReady(),
            'tiers'         => Tiers::KEYS,
            'config'        => Settings::get('tiers'),
            'catalog'       => Features::catalog(),
            'club_plans'    => Cast::rows($clubPlans, [], ['price_toman', 'duration_days', 'max_members'], ['is_active']),
            'trainer_plans' => Cast::rows($trainerPlans, [], ['price_toman', 'duration_days', 'max_athletes'], ['is_active']),
            'running'       => $running,
        ]);
    }

    /**
     * PUT /admin/tiers/plans/{kind}/{id} — {tier} for a club plan (kind club)
     * or a trainer plan (kind trainer). Running subscriptions bought with this
     * plan (same name) that have no tier yet get it too.
     */
    public static function setPlanTier(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!Tiers::ready()) {
            Response::error(409, 'migration_required', 'سطح پلن‌ها هنوز فعال نیست. به‌روزرسانی «سطح پلن‌ها: رایگان، نقره‌ای، طلایی و الماسی» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            return;
        }
        [$planTable, $subscriptionTable] = match ($params['kind']) {
            'club'    => ['plans', 'subscriptions'],
            'trainer' => ['trainer_plans', 'trainer_subscriptions'],
            default   => [null, null],
        };
        if ($planTable === null) {
            Response::error(404, 'not_found', 'نوع پلن نامعتبر است.');
            return;
        }
        $tier = Validate::body()['tier'] ?? null;
        if ($tier !== null && !Tiers::valid($tier)) {
            Response::error(400, 'invalid_tier', 'سطح باید رایگان، نقره‌ای، طلایی یا الماسی باشد.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare("SELECT name FROM {$planTable} WHERE id = :id");
        $stmt->execute(['id' => $params['id']]);
        $name = $stmt->fetchColumn();
        if ($name === false) {
            Response::error(404, 'not_found', 'پلن پیدا نشد.');
            return;
        }

        $pdo->prepare("UPDATE {$planTable} SET tier = :tier WHERE id = :id")->execute(['tier' => $tier, 'id' => $params['id']]);
        $backfill = $pdo->prepare(
            "UPDATE {$subscriptionTable} SET tier = :tier WHERE plan_name = :name AND tier IS NULL AND expires_at > NOW()"
        );
        $backfill->execute(['tier' => $tier, 'name' => $name]);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'plan_tier_set', [
            'kind' => $params['kind'], 'plan' => $name, 'tier' => $tier, 'subscriptions' => $backfill->rowCount(),
        ]);
        Response::ok(['tier' => $tier, 'subscriptions_updated' => $backfill->rowCount()]);
    }
}
