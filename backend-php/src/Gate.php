<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * Runs before routing and applies the admin's site-wide switches to every
 * request: maintenance mode, and panel sections switched off for everyone or
 * for one account type. A platform admin passes through both, so the admin
 * can keep working (and switch things back on) while they are in effect.
 *
 * The user is only looked up when a switch is actually in effect, so with
 * everything on this costs the one settings query and nothing else. The
 * same goes for plan tiers (Tiers): a section that every tier opens (and no
 * account has switched off by hand) costs nothing; otherwise the user's tier
 * and their own access (AccountAccess) are looked up.
 */
final class Gate
{
    /**
     * Never gated: the health check, browser error reports, signing in/out
     * (an admin has to be able to log in during maintenance), the settings
     * the frontend needs to show the right screen, the public text pages
     * (terms, privacy), and the admin panel itself.
     */
    private const OPEN = [
        '#^/health$#',
        '#^/client-errors$#',
        '#^/auth/#',
        '#^/settings/public$#',
        '#^/pages(/|$)#',
        '#^/admin/#',
    ];

    private function __construct()
    {
    }

    public static function enforce(string $path): void
    {
        foreach (self::OPEN as $pattern) {
            if (preg_match($pattern, $path) === 1) {
                return;
            }
        }

        $maintenance = Settings::get('maintenance');
        $sections = Features::forPath($path);
        $blocked = array_values(array_filter($sections, static fn (string $key): bool => !Features::fullyEnabled($key)));
        // Sections some plan tier doesn't open (Tiers): only then is the tier looked up.
        $tiered = array_values(array_filter($sections, static fn (string $key): bool => Tiers::restricts($key)));

        if (!$maintenance['enabled'] && $blocked === [] && $tiered === []) {
            return;
        }

        // No session: let the endpoint answer 401 (or serve its public data).
        $user = Auth::currentUser();
        if ($user === null || (int) $user['is_platform_admin'] === 1) {
            return;
        }

        if ($maintenance['enabled']) {
            Response::error(
                503,
                'maintenance',
                $maintenance['message'] !== ''
                    ? $maintenance['message']
                    : 'جیم‌لیک در حال به‌روزرسانی است. لطفاً کمی بعد دوباره سر بزنید.'
            );
            exit;
        }

        foreach ($blocked as $key) {
            if (!Features::enabledFor($key, $user['account_type'])) {
                Response::error(
                    403,
                    'feature_disabled',
                    'بخش «' . Features::label($key) . '» در حال حاضر توسط مدیریت غیرفعال شده است.'
                );
                exit;
            }
        }

        if ($tiered !== []) {
            $pdo = Database::connection();
            $tier = Tiers::effective($pdo, $user);
            foreach ($tiered as $key) {
                if (Tiers::allowsUser($pdo, $user, $key)) {
                    continue;
                }
                $label = Features::label($key);
                Response::error(
                    403,
                    'tier_locked',
                    match (true) {
                        // Off by the admin for this account (or its trainer's), not by the plan.
                        Tiers::allows($tier, $key) => 'بخش «' . $label . '» برای حساب شما فعال نیست. برای فعال‌شدن با پشتیبانی تماس بگیرید.',
                        $user['account_type'] === 'athlete' => 'بخش «' . $label . '» در پلن مربی شما فعال نیست.',
                        default => 'بخش «' . $label . '» در پلن فعلی شما («' . Tiers::label($tier) . '») نیست. برای استفاده، پلن بالاتری تهیه کنید.',
                    }
                );
                exit;
            }
        }
    }
}
