<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;

final class AuthController
{
    private static function profilePublic(array $p): array
    {
        return [
            'id'                => $p['id'],
            'email'             => $p['email'],
            'phone'             => $p['phone'],
            'first_name'        => $p['first_name'],
            'last_name'         => $p['last_name'],
            'avatar_url'        => $p['avatar_url'],
            'account_type'      => $p['account_type'],
            'birth_date'        => $p['birth_date'],
            'is_platform_admin' => (bool) $p['is_platform_admin'],
        ];
    }

    public static function signup(): void
    {
        $data = Validate::required(Validate::body(), ['email', 'password']);
        $email = strtolower(trim((string) $data['email']));
        $password = (string) $data['password'];

        if (!Validate::email($email)) {
            Response::error(400, 'invalid_email', 'Enter a valid email address.');
            return;
        }
        if (strlen($password) < 8) {
            Response::error(400, 'weak_password', 'Password must be at least 8 characters.');
            return;
        }

        $pdo = Database::connection();

        $exists = $pdo->prepare('SELECT id FROM profiles WHERE email = :email');
        $exists->execute(['email' => $email]);
        if ($exists->fetch() !== false) {
            Response::error(409, 'email_taken', 'An account with this email already exists.');
            return;
        }

        $id = Uuid::v4();
        $stmt = $pdo->prepare(
            'INSERT INTO profiles (id, email, password_hash, first_name, last_name)
             VALUES (:id, :email, :hash, :first_name, :last_name)'
        );
        $stmt->execute([
            'id'         => $id,
            'email'      => $email,
            'hash'       => Auth::hashPassword($password),
            'first_name' => Validate::nullableString($data['first_name'] ?? null),
            'last_name'  => Validate::nullableString($data['last_name'] ?? null),
        ]);

        $session = Auth::createSession($id);
        $user = self::fetchProfile($id);

        Response::ok(['token' => $session['token'], 'user' => self::profilePublic($user)], 201);
    }

    public static function login(): void
    {
        $data = Validate::required(Validate::body(), ['email', 'password']);
        $email = strtolower(trim((string) $data['email']));

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT * FROM profiles WHERE email = :email');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if ($user === false || !Auth::verifyPassword((string) $data['password'], $user['password_hash'])) {
            Response::error(401, 'invalid_credentials', 'Incorrect email or password.');
            return;
        }
        if ((int) $user['is_suspended'] === 1) {
            Response::error(403, 'account_suspended', 'This account has been suspended.');
            return;
        }

        $session = Auth::createSession($user['id']);
        Response::ok(['token' => $session['token'], 'user' => self::profilePublic($user)]);
    }

    public static function logout(): void
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            Auth::destroySession($m[1]);
        }
        Response::ok(['ok' => true]);
    }

    public static function me(): void
    {
        $user = Auth::requireUser();

        $pdo = Database::connection();

        // Trainer link (if account_type = athlete)
        $trainer = null;
        if ($user['account_type'] === 'athlete') {
            $stmt = $pdo->prepare(
                "SELECT trainer_id FROM trainer_athletes WHERE athlete_id = :id AND status = 'active' LIMIT 1"
            );
            $stmt->execute(['id' => $user['id']]);
            $row = $stmt->fetch();
            $trainer = $row['trainer_id'] ?? null;
        }

        // Club membership (if any)
        $stmt = $pdo->prepare(
            "SELECT club_id, role, status FROM memberships WHERE user_id = :id AND status = 'active' LIMIT 1"
        );
        $stmt->execute(['id' => $user['id']]);
        $membership = $stmt->fetch() ?: null;

        Response::ok([
            'user'       => self::profilePublic($user),
            'trainer_id' => $trainer,
            'membership' => $membership,
        ]);
    }

    public static function chooseRole(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['account_type']);
        $role = (string) $data['account_type'];

        if (!in_array($role, ['club', 'trainer', 'athlete'], true)) {
            Response::error(400, 'invalid_role', 'account_type must be club, trainer, or athlete.');
            return;
        }

        $pdo = Database::connection();
        $wasUnset = $user['account_type'] === null;

        $stmt = $pdo->prepare(
            'UPDATE profiles SET account_type = :role,
               first_name = COALESCE(:first_name, first_name),
               last_name = COALESCE(:last_name, last_name)
             WHERE id = :id'
        );
        $body = Validate::body();
        $stmt->execute([
            'role'       => $role,
            'first_name' => Validate::nullableString($body['first_name'] ?? null),
            'last_name'  => Validate::nullableString($body['last_name'] ?? null),
            'id'         => $user['id'],
        ]);

        if ($wasUnset && $role !== 'club') {
            self::notify($pdo, $user['id'], $user['id'], 'complete_profile', 'تکمیل پروفایل', 'برای شروع، پروفایل خود را تکمیل کنید.', '/settings');
        }

        Response::ok(['user' => self::profilePublic(self::fetchProfile($user['id']))]);
    }

    public static function invitationPreview(): void
    {
        $code = (string) ($_GET['code'] ?? '');
        if ($code === '') {
            Response::error(400, 'missing_code', 'code query parameter is required.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "SELECT i.first_name, i.last_name, i.invited_role, c.name AS club_name
             FROM invitations i
             LEFT JOIN clubs c ON c.id = i.club_id
             WHERE i.code = :code AND i.status = 'pending' AND i.expires_at > NOW()"
        );
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();

        if ($row === false) {
            Response::error(404, 'invitation_not_found', 'This invitation is invalid or has expired.');
            return;
        }

        Response::ok($row);
    }

    private static function fetchProfile(string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM profiles WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function notify(PDO $pdo, string $recipientId, ?string $actorId, string $type, string $title, ?string $body, ?string $link, array $metadata = []): void
    {
        $stmt = $pdo->prepare(
            'INSERT INTO notifications (id, recipient_id, actor_id, type, title, body, link, metadata)
             VALUES (:id, :recipient_id, :actor_id, :type, :title, :body, :link, :metadata)'
        );
        $stmt->execute([
            'id'           => Uuid::v4(),
            'recipient_id' => $recipientId,
            'actor_id'     => $actorId,
            'type'         => $type,
            'title'        => $title,
            'body'         => $body,
            'link'         => $link,
            'metadata'     => json_encode($metadata, JSON_UNESCAPED_UNICODE),
        ]);
    }
}
