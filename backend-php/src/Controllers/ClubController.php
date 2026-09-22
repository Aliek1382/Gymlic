<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
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

        $stmt = $pdo->prepare('SELECT * FROM clubs WHERE id = :id');
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

        Response::ok($club);
    }
}
