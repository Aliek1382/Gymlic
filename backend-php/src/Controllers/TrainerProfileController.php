<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Templates;
use Gymlic\TrainerVerification;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * A trainer's self-written résumé, shown read-only to the athletes they train.
 * One row per trainer (trainer_id is the PK); the list-shaped parts live in
 * JSON columns because they are always read and replaced as a whole.
 */
final class TrainerProfileController
{
    private const MAX_BIO = 5000;
    private const MAX_ACHIEVEMENTS = 30;
    private const MAX_CERTIFICATES = 12;
    private const MAX_PRICING_ROWS = 20;
    private const MAX_TEXT = 255;
    private const MAX_DESCRIPTION = 500;
    private const MAX_PRICE_TOMAN = 100_000_000_000;
    private const SOCIAL_KEYS = ['instagram', 'telegram', 'website'];

    /**
     * POST /trainer-profile/verification — sends the saved certificates to
     * the admins for the "verified trainer" badge.
     */
    public static function requestVerification(): void
    {
        $user = self::requireTrainer();
        $pdo = Database::connection();
        if (!TrainerVerification::ready()) {
            self::fail('verification_not_ready', 'تأیید مدارک هنوز فعال نشده است.');
        }
        $profile = self::load($user['id']);
        if ($profile['certificates'] === []) {
            self::fail('no_certificates', 'اول دست‌کم یک تصویر مدرک در رزومه بارگذاری و ذخیره کنید.');
        }
        $status = $profile['verification']['status'] ?? 'none';
        if ($status === 'pending' || $status === 'verified') {
            self::fail('already_' . $status, $status === 'pending' ? 'مدارک شما در حال بررسی است.' : 'مدارک شما قبلاً تأیید شده است.');
        }

        $pdo->prepare(
            "UPDATE trainer_profiles SET verification_status = 'pending', verification_note = NULL,
                    verification_requested_at = NOW() WHERE trainer_id = :id"
        )->execute(['id' => $user['id']]);

        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) ?: (string) $user['email'];
        foreach (AdminAccess::holders($pdo, 'users.manage') as $adminId) {
            Templates::notify($pdo, 'trainer_verification_requested', $adminId, $user['id'], 'broadcast', ['name' => $name], '/admin/verifications');
        }

        Response::ok(self::load($user['id']));
    }

    /** GET /trainer-profile — the trainer's own résumé, for editing. */
    public static function mine(): void
    {
        $user = self::requireTrainer();
        Response::ok(self::load($user['id']));
    }

    /** PUT /trainer-profile — replaces the whole résumé in one statement. */
    public static function save(): void
    {
        $user = self::requireTrainer();
        $data = Validate::body();

        $bio = self::bio($data['bio'] ?? null);
        $achievements = self::achievements($data['achievements'] ?? []);
        $certificates = self::certificates($data['certificates'] ?? [], $user['id']);
        $pricing = self::pricing($data['pricing_table'] ?? []);
        $social = self::socialLinks($data['social_links'] ?? []);

        // trainer_id is the PK, so insert-or-replace is a single statement.
        Database::connection()->prepare(
            'INSERT INTO trainer_profiles
                (trainer_id, bio, achievements, certificates, pricing_table, social_links)
             VALUES (:trainer_id, :bio, :achievements, :certificates, :pricing_table, :social_links)
             ON DUPLICATE KEY UPDATE
                bio = VALUES(bio),
                achievements = VALUES(achievements),
                certificates = VALUES(certificates),
                pricing_table = VALUES(pricing_table),
                social_links = VALUES(social_links)'
        )->execute([
            'trainer_id'    => $user['id'],
            'bio'           => $bio,
            'achievements'  => json_encode($achievements, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'certificates'  => json_encode($certificates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'pricing_table' => json_encode($pricing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'social_links'  => json_encode((object) $social, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        Response::ok(self::load($user['id']));
    }

    /**
     * GET /trainer-profile/{trainerId} — an athlete reads their own trainer's
     * résumé. Anyone else gets 404, not 403, so the id doesn't confirm that
     * the trainer exists.
     */
    public static function view(array $params): void
    {
        $user = Auth::requireUser();
        $trainerId = $params['trainerId'];

        if (!Acl::isTrainerOf($trainerId, $user['id'])) {
            Response::error(404, 'not_found', 'Trainer profile not found.');
            return;
        }

        $stmt = Database::connection()->prepare(
            'SELECT id, first_name, last_name, avatar_url FROM profiles WHERE id = :id'
        );
        $stmt->execute(['id' => $trainerId]);
        $trainer = $stmt->fetch();
        if ($trainer === false) {
            Response::error(404, 'not_found', 'Trainer profile not found.');
            return;
        }

        // The athlete sees the badge, never the admin's notes on the review.
        $profile = self::load($trainerId);
        $trainer['is_verified'] = ($profile['verification']['status'] ?? 'none') === 'verified';
        unset($profile['verification']);
        Response::ok(['trainer' => $trainer] + $profile);
    }

    /** POST /trainer-profile/certificates — stores one image and returns its URL; the DB is untouched. */
    public static function uploadCertificate(): void
    {
        $user = self::requireTrainer();

        // Unique per upload: unlike the avatar, several certificates coexist.
        $url = UploadController::storeImage($user['id'], 'certificate-' . Uuid::v4() . '.jpg');

        Response::ok(['url' => $url]);
    }

    private static function requireTrainer(): array
    {
        $user = Auth::requireUser();
        Acl::require($user['account_type'] === 'trainer', 'Only trainers have a résumé.');
        return $user;
    }

    /** The résumé row decoded for the client; an empty shape when never filled in. */
    private static function load(string $trainerId): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM trainer_profiles WHERE trainer_id = :id');
        $stmt->execute(['id' => $trainerId]);
        $row = $stmt->fetch();

        $verification = TrainerVerification::of(Database::connection(), $trainerId);

        if ($row === false) {
            return [
                'bio'           => null,
                'achievements'  => [],
                'certificates'  => [],
                'pricing_table' => [],
                'social_links'  => new \stdClass(),
                'updated_at'    => null,
                'verification'  => $verification,
            ];
        }

        $pricing = json_decode($row['pricing_table'] ?? '[]', true) ?: [];
        foreach ($pricing as &$item) {
            $item['price_toman'] = (int) $item['price_toman'];
        }
        unset($item);

        return [
            'bio'           => $row['bio'],
            'achievements'  => json_decode($row['achievements'] ?? '[]', true) ?: [],
            'certificates'  => json_decode($row['certificates'] ?? '[]', true) ?: [],
            'pricing_table' => $pricing,
            'social_links'  => json_decode($row['social_links'] ?? '{}') ?: new \stdClass(),
            'updated_at'    => $row['updated_at'],
            // null before operations-update.sql; the athlete's view shows only the badge.
            'verification'  => $verification,
        ];
    }

    /** Every validator below ends the request with 400 on bad input. */
    private static function fail(string $code, string $message): never
    {
        Response::error(400, $code, $message);
        exit;
    }

    private static function bio(mixed $value): ?string
    {
        if ($value !== null && !is_string($value)) {
            self::fail('invalid_bio', 'bio must be a string.');
        }
        $bio = Validate::nullableString($value === null ? null : trim($value));
        if ($bio !== null && mb_strlen($bio) > self::MAX_BIO) {
            self::fail('bio_too_long', 'bio must be at most ' . self::MAX_BIO . ' characters.');
        }
        return $bio;
    }

    /** @return string[] */
    private static function achievements(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            self::fail('invalid_achievements', 'achievements must be a list of strings.');
        }
        $items = [];
        foreach ($value as $item) {
            if (!is_string($item)) {
                self::fail('invalid_achievements', 'achievements must be a list of strings.');
            }
            $item = trim($item);
            if ($item === '') {
                continue;
            }
            if (mb_strlen($item) > self::MAX_TEXT) {
                self::fail('achievement_too_long', 'Each achievement must be at most ' . self::MAX_TEXT . ' characters.');
            }
            $items[] = $item;
        }
        if (count($items) > self::MAX_ACHIEVEMENTS) {
            self::fail('too_many_achievements', 'At most ' . self::MAX_ACHIEVEMENTS . ' achievements.');
        }
        return $items;
    }

    /**
     * Only URLs this trainer's own certificate uploads produced: the value is
     * rendered as <img src>, so arbitrary or foreign URLs are not accepted.
     *
     * @return string[]
     */
    private static function certificates(mixed $value, string $trainerId): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            self::fail('invalid_certificates', 'certificates must be a list of image URLs.');
        }
        if (count($value) > self::MAX_CERTIFICATES) {
            self::fail('too_many_certificates', 'At most ' . self::MAX_CERTIFICATES . ' certificate images.');
        }
        $pattern = '#^https?://[^/?\#]+/.+/' . preg_quote($trainerId, '#')
            . '/certificate-[0-9a-f-]{36}\.jpg(\?t=\d+)?$#';
        foreach ($value as $url) {
            if (!is_string($url) || strlen($url) > 1024 || preg_match($pattern, $url) !== 1) {
                self::fail('invalid_certificates', 'certificates must be images uploaded from your own account.');
            }
        }
        return $value;
    }

    /** @return array<int, array{title: string, price_toman: int, description: string}> */
    private static function pricing(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            self::fail('invalid_pricing', 'pricing_table must be a list.');
        }
        if (count($value) > self::MAX_PRICING_ROWS) {
            self::fail('too_many_pricing_rows', 'At most ' . self::MAX_PRICING_ROWS . ' pricing rows.');
        }
        $rows = [];
        foreach ($value as $item) {
            $title = is_array($item) && is_string($item['title'] ?? null) ? trim($item['title']) : '';
            if ($title === '' || mb_strlen($title) > self::MAX_TEXT) {
                self::fail('invalid_pricing', 'Each pricing row needs a title of up to ' . self::MAX_TEXT . ' characters.');
            }
            $price = $item['price_toman'] ?? null;
            if (is_string($price) && ctype_digit($price)) {
                $price = (int) $price;
            }
            if (is_float($price) && floor($price) === $price && abs($price) < 1e15) {
                $price = (int) $price;
            }
            if (!is_int($price) || $price < 0 || $price > self::MAX_PRICE_TOMAN) {
                self::fail('invalid_pricing', 'price_toman must be a non-negative whole number.');
            }
            $description = $item['description'] ?? '';
            if ($description === null) {
                $description = '';
            }
            if (!is_string($description) || mb_strlen(trim($description)) > self::MAX_DESCRIPTION) {
                self::fail('invalid_pricing', 'description must be text of up to ' . self::MAX_DESCRIPTION . ' characters.');
            }
            $rows[] = ['title' => $title, 'price_toman' => $price, 'description' => trim($description)];
        }
        return $rows;
    }

    /**
     * Known keys only, and every value ends up an http(s) URL: the frontend
     * puts it in an href, where a `javascript:` value would run.
     *
     * @return array<string, string>
     */
    private static function socialLinks(mixed $value): array
    {
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            self::fail('invalid_social_links', 'social_links must be an object.');
        }
        $unknown = array_diff(array_keys($value), self::SOCIAL_KEYS);
        if ($unknown !== []) {
            self::fail('invalid_social_links', 'Unknown social link(s): ' . implode(', ', $unknown));
        }

        $links = [];
        foreach ($value as $key => $link) {
            if ($link === null) {
                continue;
            }
            if (!is_string($link)) {
                self::fail('invalid_social_links', "{$key} must be a string.");
            }
            $link = trim($link);
            if ($link === '') {
                continue;
            }
            // A bare handle is fine for the two messengers.
            if ($key !== 'website' && preg_match('/^@?[A-Za-z0-9._]{1,64}$/', $link) === 1) {
                $host = $key === 'instagram' ? 'instagram.com' : 't.me';
                $link = "https://{$host}/" . ltrim($link, '@');
            }
            if (strlen($link) > 512 || preg_match('#^https?://[^\s/]+\S*$#i', $link) !== 1
                || filter_var($link, FILTER_VALIDATE_URL) === false) {
                self::fail('invalid_social_links', "{$key} must be a valid http(s) link.");
            }
            $links[$key] = $link;
        }
        return $links;
    }
}
