<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Throwable;

final class ClubController
{
    public static function create(): void
    {
        $user = Auth::requireUser();

        if ($user['account_type'] !== null && $user['account_type'] !== 'club') {
            Response::error(409, 'account_type_mismatch', 'This account already has a different role.');
            return;
        }

        $data = Validate::required(Validate::body(), ['name']);
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $clubId = Uuid::v4();
            $pdo->prepare(
                'INSERT INTO clubs (id, name, owner_id, status) VALUES (:id, :name, :owner_id, "pending")'
            )->execute([
                'id'       => $clubId,
                'name'     => (string) $data['name'],
                'owner_id' => $user['id'],
            ]);

            $pdo->prepare(
                'INSERT INTO memberships (id, club_id, user_id, role, status)
                 VALUES (:id, :club_id, :user_id, "owner", "active")'
            )->execute([
                'id'      => Uuid::v4(),
                'club_id' => $clubId,
                'user_id' => $user['id'],
            ]);

            $pdo->prepare('UPDATE profiles SET account_type = "club" WHERE id = :id')
                ->execute(['id' => $user['id']]);

            $pdo->commit();
            Response::ok(['club_id' => $clubId], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();
            Response::error(500, 'club_create_failed', 'Could not create the club.');
        }
    }

    public static function get(array $params): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT c.id, c.name, c.logo_url, c.address, c.phone, c.working_hours,
                    c.member_capacity, c.status, c.owner_id,
                    s.plan_name AS subscription_plan_name,
                    s.status AS subscription_status,
                    s.expires_at AS subscription_expires_at
             FROM clubs c
             LEFT JOIN subscriptions s ON s.club_id = c.id
             WHERE c.id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $club = $stmt->fetch();

        if ($club === false) {
            Response::error(404, 'not_found', 'Club not found.');
            return;
        }

        $member = $pdo->prepare('SELECT id FROM memberships WHERE club_id = :club_id AND user_id = :user_id');
        $member->execute(['club_id' => $club['id'], 'user_id' => $user['id']]);
        if ($member->fetch() === false && (int) $user['is_platform_admin'] !== 1) {
            Response::error(403, 'forbidden', 'You are not a member of this club.');
            return;
        }

        Response::ok(Cast::row($club, [], ['member_capacity']));
    }

    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $params['id']];

        foreach (['name', 'address', 'phone', 'working_hours'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = Validate::nullableString($data[$key] === null ? null : (string) $data[$key]);
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE clubs SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    // ---- Membership plans the club itself defines and sells ---------------

    public static function listMembershipPlans(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::isClubMember($user['id'], $clubId));

        $stmt = Database::connection()->prepare(
            "SELECT p.id, p.name, p.price_toman, p.duration_days, p.description,
                    p.is_active, p.sort_order,
                    (SELECT COUNT(*) FROM memberships m
                      WHERE m.plan_id = p.id AND m.status = 'active') AS member_count
             FROM club_membership_plans p
             WHERE p.club_id = :club_id
             ORDER BY p.sort_order ASC, p.created_at ASC"
        );
        $stmt->execute(['club_id' => $clubId]);

        Response::ok([
            'items' => Cast::rows(
                $stmt->fetchAll(),
                [],
                ['price_toman', 'duration_days', 'sort_order', 'member_count'],
                ['is_active']
            ),
        ]);
    }

    public static function createMembershipPlan(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $data = Validate::required(Validate::body(), ['name', 'price_toman', 'duration_days']);

        if ((int) $data['duration_days'] <= 0) {
            Response::error(400, 'invalid_duration', 'Duration must be at least one day.');
            return;
        }

        $pdo = Database::connection();
        $next = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM club_membership_plans WHERE club_id = :club_id'
        );
        $next->execute(['club_id' => $clubId]);

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO club_membership_plans
               (id, club_id, name, price_toman, duration_days, description, is_active, sort_order)
             VALUES (:id, :club_id, :name, :price_toman, :duration_days, :description, :is_active, :sort_order)'
        )->execute([
            'id'            => $id,
            'club_id'       => $clubId,
            'name'          => (string) $data['name'],
            'price_toman'   => (int) $data['price_toman'],
            'duration_days' => (int) $data['duration_days'],
            'description'   => Validate::nullableString($data['description'] ?? null),
            'is_active'     => array_key_exists('is_active', $data) ? (int) (bool) $data['is_active'] : 1,
            'sort_order'    => (int) $next->fetch()['next'],
        ]);

        Response::ok(['id' => $id], 201);
    }

    public static function updateMembershipPlan(array $params): void
    {
        $user = Auth::requireUser();
        $plan = self::membershipPlanForManager($user, $params['id']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $plan['id']];

        foreach (['name', 'price_toman', 'duration_days', 'description', 'is_active', 'sort_order'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $key === 'is_active' ? (int) (bool) $data[$key] : $data[$key];
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE club_membership_plans SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    /**
     * Members already on the plan keep their membership: the foreign key is
     * ON DELETE SET NULL, so deleting a plan cannot delete anyone's place in
     * the club.
     */
    public static function deleteMembershipPlan(array $params): void
    {
        $user = Auth::requireUser();
        $plan = self::membershipPlanForManager($user, $params['id']);

        Database::connection()
            ->prepare('DELETE FROM club_membership_plans WHERE id = :id')
            ->execute(['id' => $plan['id']]);

        Response::ok(['ok' => true]);
    }

    private static function membershipPlanForManager(array $user, string $planId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, club_id FROM club_membership_plans WHERE id = :id'
        );
        $stmt->execute(['id' => $planId]);
        $plan = $stmt->fetch();

        if ($plan === false) {
            Response::error(404, 'not_found', 'Membership plan not found.');
            exit;
        }
        Acl::require(Acl::managesClub($user['id'], $plan['club_id']));

        return $plan;
    }
}
