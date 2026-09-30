<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\PointsService;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * The admin's side of coach points: the per-action rules, the levels (stored
 * in app_settings, edited through the settings endpoint), a leaderboard, and
 * points added or taken away by hand.
 */
final class AdminPointsController
{
    /** coach_point_logs.action_type of an admin's manual award; it has no rule. */
    public const ADJUSTMENT = 'admin_adjustment';

    private const LEADERBOARD_LIMIT = 100;

    private const MAX_RULE_POINTS = 10_000;

    private const MAX_ADJUSTMENT = 100_000;

    public static function overview(): void
    {
        Auth::requirePlatformAdmin();
        $pdo = Database::connection();

        $rules = $pdo->query('SELECT action_type, label, points, is_active FROM point_rules ORDER BY label')->fetchAll();

        $leaders = $pdo->query(
            "SELECT p.id, p.first_name, p.last_name, p.avatar_url,
                    COALESCE(SUM(l.points), 0) AS total_points,
                    MAX(l.created_at) AS last_award_at
             FROM profiles p
             LEFT JOIN coach_point_logs l ON l.coach_id = p.id
             WHERE p.account_type = 'trainer'
             GROUP BY p.id, p.first_name, p.last_name, p.avatar_url
             ORDER BY total_points DESC, p.first_name ASC
             LIMIT " . self::LEADERBOARD_LIMIT
        )->fetchAll();

        foreach ($leaders as &$leader) {
            $leader['total_points'] = (int) $leader['total_points'];
            $leader['level'] = PointsService::currentLevel($leader['total_points'])['name'];
        }
        unset($leader);

        Response::ok([
            'rules'         => Cast::rows($rules, [], ['points'], ['is_active']),
            'levels'        => Settings::get('points_levels')['levels'],
            'levels_ready'  => Settings::storageReady(),
            'leaderboard'   => $leaders,
        ]);
    }

    /** Edits one rule. Which actions exist is fixed by the code that awards them. */
    public static function updateRule(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();
        $pdo = Database::connection();

        $exists = $pdo->prepare('SELECT label FROM point_rules WHERE action_type = :action');
        $exists->execute(['action' => $params['action']]);
        if ($exists->fetch() === false) {
            Response::error(404, 'not_found', 'این قانون امتیاز وجود ندارد.');
            return;
        }

        $values = [];
        if (array_key_exists('label', $data)) {
            $label = trim((string) $data['label']);
            if ($label === '' || mb_strlen($label) > 255) {
                Response::error(400, 'invalid_label', 'عنوان قانون را وارد کنید (حداکثر ۲۵۵ حرف).');
                return;
            }
            $values['label'] = $label;
        }
        if (array_key_exists('points', $data)) {
            $points = filter_var($data['points'], FILTER_VALIDATE_INT);
            if ($points === false || $points < 1 || $points > self::MAX_RULE_POINTS) {
                Response::error(400, 'invalid_points', 'امتیاز باید عددی بین ۱ تا ۱۰٬۰۰۰ باشد. برای قطع امتیاز، قانون را غیرفعال کنید.');
                return;
            }
            $values['points'] = $points;
        }
        if (array_key_exists('is_active', $data)) {
            $values['is_active'] = (int) (bool) $data['is_active'];
        }
        if ($values === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $sets = array_map(static fn (string $c): string => "{$c} = :{$c}", array_keys($values));
        $pdo->prepare('UPDATE point_rules SET ' . implode(', ', $sets) . ' WHERE action_type = :action')
            ->execute($values + ['action' => $params['action']]);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'point_rule_updated', [
            'action_type' => $params['action'],
        ] + $values);

        Response::ok(['ok' => true]);
    }

    /** Adds (or, with a negative number, takes away) points from one coach. */
    public static function adjust(): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::required(Validate::body(), ['coach_id', 'points']);
        $pdo = Database::connection();

        $points = filter_var($data['points'], FILTER_VALIDATE_INT);
        if ($points === false || $points === 0 || abs($points) > self::MAX_ADJUSTMENT) {
            Response::error(400, 'invalid_points', 'امتیاز باید عددی غیرصفر بین −۱۰۰٬۰۰۰ و ۱۰۰٬۰۰۰ باشد.');
            return;
        }

        $coach = $pdo->prepare("SELECT id FROM profiles WHERE id = :id AND account_type = 'trainer'");
        $coach->execute(['id' => (string) $data['coach_id']]);
        if ($coach->fetch() === false) {
            Response::error(404, 'not_found', 'این مربی پیدا نشد.');
            return;
        }

        $pdo->prepare(
            'INSERT INTO coach_point_logs (id, coach_id, action_type, points)
             VALUES (:id, :coach_id, :action, :points)'
        )->execute([
            'id'       => Uuid::v4(),
            'coach_id' => (string) $data['coach_id'],
            'action'   => self::ADJUSTMENT,
            'points'   => $points,
        ]);

        AdminController::logActivity($pdo, null, $admin['id'], (string) $data['coach_id'], 'points_adjusted', [
            'points' => $points,
        ]);

        Response::ok(['ok' => true], 201);
    }
}
