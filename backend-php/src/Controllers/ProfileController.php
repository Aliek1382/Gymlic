<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Validate;

final class ProfileController
{
    public static function updateProfile(): void
    {
        $user = Auth::requireUser();
        $data = Validate::body();

        $fields = [];
        $params = ['id' => $user['id']];

        foreach (['first_name', 'last_name', 'phone', 'birth_date'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $params[$key] = Validate::nullableString($data[$key] === null ? null : (string) $data[$key]);
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($params);

        Response::ok(['ok' => true]);
    }

    /**
     * Supabase kept a confirmed auth.users.email plus a display mirror in
     * profiles; here profiles IS the account, so this is a single update.
     */
    public static function updateEmail(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['email']);
        $email = strtolower(trim((string) $data['email']));

        if (!Validate::email($email)) {
            Response::error(400, 'invalid_email', 'Enter a valid email address.');
            return;
        }

        $pdo = Database::connection();
        $taken = $pdo->prepare('SELECT 1 FROM profiles WHERE email = :email AND id <> :id');
        $taken->execute(['email' => $email, 'id' => $user['id']]);
        if ($taken->fetch() !== false) {
            Response::error(409, 'email_taken', 'Another account already uses this email.');
            return;
        }

        $pdo->prepare('UPDATE profiles SET email = :email WHERE id = :id')
            ->execute(['email' => $email, 'id' => $user['id']]);

        Response::ok(['ok' => true]);
    }

    public static function updatePassword(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['current_password', 'password']);

        if (!Auth::verifyPassword((string) $data['current_password'], $user['password_hash'])) {
            Response::error(403, 'wrong_password', 'Your current password is incorrect.');
            return;
        }
        if (strlen((string) $data['password']) < 8) {
            Response::error(400, 'weak_password', 'Password must be at least 8 characters.');
            return;
        }

        $pdo = Database::connection();
        $pdo->prepare('UPDATE profiles SET password_hash = :hash WHERE id = :id')
            ->execute(['hash' => Auth::hashPassword((string) $data['password']), 'id' => $user['id']]);

        // Other devices keep a token minted against the old password.
        $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute(['id' => $user['id']]);

        $session = Auth::createSession($user['id']);
        Response::ok(['token' => $session['token']]);
    }

    public static function get(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::canViewProfile($user, $params['id']));

        $stmt = Database::connection()->prepare(
            'SELECT id, first_name, last_name, email, phone, avatar_url, account_type, birth_date
             FROM profiles WHERE id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $profile = $stmt->fetch();

        if ($profile === false) {
            Response::error(404, 'not_found', 'Profile not found.');
            return;
        }

        Response::ok($profile);
    }
}
