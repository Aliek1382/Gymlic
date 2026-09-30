<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
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

        // Calorie goal and macro split only mean something for an athlete.
        $goal = self::nutritionGoal($data, $user);
        if ($goal !== []) {
            Acl::require($user['account_type'] === 'athlete', 'Only athletes have a calorie goal.');
            foreach ($goal as $key => $value) {
                $fields[] = "{$key} = :{$key}";
                $params[$key] = $value;
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

    public const NUTRITION_GOAL_KEYS = ['daily_calorie_goal', 'protein_percent', 'carbs_percent', 'fat_percent'];

    /**
     * The nutrition-goal columns present in $data, validated and ready to
     * bind ([] when the request touches none of them). $current is the
     * profile row as it stands: the three percentages are checked as a set
     * after merging, so a PATCH that sends only one of them is judged against
     * the other two — they are all filled and add up to 100, or all empty.
     * Ends the request with 400 otherwise. Shared with the trainer's
     * AthleteController::updateNutritionGoal.
     *
     * @return array<string, int|null>
     */
    public static function nutritionGoal(array $data, array $current): array
    {
        $touched = array_values(array_filter(self::NUTRITION_GOAL_KEYS, fn ($k) => array_key_exists($k, $data)));
        if ($touched === []) {
            return [];
        }

        $values = [];
        foreach ($touched as $key) {
            $max = $key === 'daily_calorie_goal' ? 20000.0 : 100.0;
            $number = Validate::nullableNumber($data[$key], $key, $max);
            if ($number !== null && $number != floor($number)) {
                Response::error(400, 'invalid_number', "{$key} must be a whole number.");
                exit;
            }
            $values[$key] = $number === null ? null : (int) $number;
        }

        $percents = [];
        foreach (['protein_percent', 'carbs_percent', 'fat_percent'] as $key) {
            $percents[$key] = array_key_exists($key, $values) ? $values[$key] : ($current[$key] ?? null);
        }
        $filled = count(array_filter($percents, fn ($v) => $v !== null));
        if ($filled !== 0 && $filled !== 3) {
            Response::error(400, 'incomplete_macro_split', 'Enter all three macro percentages, or leave all three empty.');
            exit;
        }
        if ($filled === 3 && array_sum($percents) !== 100) {
            Response::error(400, 'invalid_macro_split', 'Protein, carbs and fat percentages must add up to 100.');
            exit;
        }

        return $values;
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
            'SELECT id, first_name, last_name, email, phone, avatar_url, account_type, birth_date,
                    daily_calorie_goal, protein_percent, carbs_percent, fat_percent
             FROM profiles WHERE id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $profile = $stmt->fetch();

        if ($profile === false) {
            Response::error(404, 'not_found', 'Profile not found.');
            return;
        }

        Response::ok(Cast::row($profile, [], self::NUTRITION_GOAL_KEYS));
    }
}
