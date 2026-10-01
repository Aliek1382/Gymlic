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
 * everything on this costs the one settings query and nothing else.
 */
final class Gate
{
    /**
     * Never gated: the health check, signing in/out (an admin has to be able
     * to log in during maintenance), the settings the frontend needs to show
     * the right screen, the public text pages (terms, privacy), and the admin
     * panel itself.
     */
    private const OPEN = [
        '#^/health$#',
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
        $blocked = array_values(array_filter(
            Features::forPath($path),
            static fn (string $key): bool => !Features::fullyEnabled($key)
        ));

        if (!$maintenance['enabled'] && $blocked === []) {
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
    }
}
