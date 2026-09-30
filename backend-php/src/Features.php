<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * The panel sections the platform admin can switch off, and the API paths
 * each one owns. Switching a section off is enforced here, in the API (see
 * Gate), not only by hiding its menu entry: the static site is public and
 * anyone can call an endpoint directly.
 *
 * Core flows — dashboards, athletes/members, workout plans, profiles,
 * notifications — are deliberately not listed: without them the panel has
 * nothing left to show. Invoices are not listed either, because a pending
 * invoice locks the plan it belongs to and switching invoices off would
 * leave those plans locked with no way to pay.
 *
 * The frontend keeps its own map of which pages belong to which key
 * (features/site-settings/constants.ts); the keys must match.
 */
final class Features
{
    /**
     * roles: the account types that use the section, i.e. those it can be
     * switched off for one at a time.
     *
     * @var array<string, array{label: string, description: string, roles: string[], routes: string[]}>
     */
    public const CATALOG = [
        'messages' => [
            'label'       => 'پیام‌ها',
            'description' => 'گفتگوی مستقیم مربی و ورزشکار، همراه با ارسال عکس، ویدیو، فایل و پیام صوتی.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => ['#^/messages(/|$)#', '#^/uploads/message-media$#'],
        ],
        'tickets' => [
            'label'       => 'تیکت‌ها',
            'description' => 'درخواست‌های رسمی ورزشکار از مربی با شمارهٔ پیگیری.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => ['#^/tickets(/|$)#'],
        ],
        'questionnaires' => [
            'label'       => 'پرسشنامه‌ها',
            'description' => 'فرم‌هایی که مربی می‌سازد و ورزشکار پر می‌کند.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => ['#^/questionnaires(/|$)#'],
        ],
        'nutrition' => [
            'label'       => 'برنامهٔ غذایی',
            'description' => 'نوشتن و دیدن برنامهٔ غذایی، کتابخانهٔ غذاها و هدف کالری ورزشکار.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => [
                '#^/plans/nutrition(/|$)#',
                '#^/library/foods(/|$)#',
                '#^/athletes/[^/]+/nutrition-goal$#',
            ],
        ],
        'supplements' => [
            'label'       => 'مکمل‌ها',
            'description' => 'کتابخانهٔ مکمل‌ها و برنامهٔ مصرف مکمل برای ورزشکار.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => ['#^/supplement-plans(/|$)#', '#^/library/supplements(/|$)#'],
        ],
        'progress' => [
            'label'       => 'پیشرفت و اندازه‌گیری‌ها',
            'description' => 'ثبت وزن و اندازه‌های بدن، نمودار پیشرفت و یادآور ارزیابی دوره‌ای.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => [
                '#^/athletes/[^/]+/measurements$#',
                '#^/measurements/#',
                '#^/progress/#',
            ],
        ],
        'session_packages' => [
            'label'       => 'جلسات خصوصی',
            'description' => 'بسته‌های جلسهٔ خصوصی که مربی برای ورزشکار تعریف می‌کند.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => ['#^/session-packages(/|$)#'],
        ],
        'trainer_resume' => [
            'label'       => 'رزومهٔ مربی',
            'description' => 'بیوگرافی، مدارک و تعرفه‌های مربی که شاگردانش می‌بینند.',
            'roles'       => ['trainer', 'athlete'],
            'routes'      => ['#^/trainer-profile(/|$)#'],
        ],
        'templates' => [
            'label'       => 'قالب‌های برنامه',
            'description' => 'ذخیره و استفادهٔ دوباره از برنامه‌های تمرینی و غذایی آماده.',
            'roles'       => ['trainer'],
            'routes'      => ['#^/plans/[^/]+/templates(/|$)#'],
        ],
        'notes' => [
            'label'       => 'یادداشت‌های مربی',
            'description' => 'یادداشت‌های خصوصی مربی دربارهٔ هر ورزشکار.',
            'roles'       => ['trainer'],
            'routes'      => ['#^/notes(/|$)#'],
        ],
        'calendar' => [
            'label'       => 'تقویم',
            'description' => 'تقویم شمسی جلسات و یادآوری‌های مربی.',
            'roles'       => ['trainer'],
            'routes'      => ['#^/calendar(/|$)#'],
        ],
        'points' => [
            'label'       => 'امتیاز مربی',
            'description' => 'امتیاز و سطح مربی بر اساس فعالیتش در پنل.',
            'roles'       => ['trainer'],
            'routes'      => ['#^/points(/|$)#'],
        ],
        'earnings' => [
            'label'       => 'درآمد مربی',
            'description' => 'ثبت شهریه‌های دریافتی و گزارش درآمد ماهانهٔ مربی.',
            'roles'       => ['trainer'],
            'routes'      => ['#^/earnings(/|$)#', '#^/reports/financial-summary$#'],
        ],
        'reports' => [
            'label'       => 'گزارش‌های مربی',
            'description' => 'آمار ماهانه، پایبندی هفتگی و نرخ تکمیل برنامه‌ها.',
            'roles'       => ['trainer'],
            'routes'      => ['#^/reports/trainer/#'],
        ],
        'club_finance' => [
            'label'       => 'امور مالی باشگاه',
            'description' => 'دفتر درآمد و هزینهٔ باشگاه.',
            'roles'       => ['club'],
            'routes'      => ['#^/clubs/[^/]+/revenue$#', '#^/revenue/#'],
        ],
    ];

    private function __construct()
    {
    }

    /** The catalogue without its route patterns, for the admin screen. */
    public static function catalog(): array
    {
        $out = [];
        foreach (self::CATALOG as $key => $meta) {
            $out[] = [
                'key'         => $key,
                'label'       => $meta['label'],
                'description' => $meta['description'],
                'roles'       => $meta['roles'],
            ];
        }
        return $out;
    }

    /**
     * Every feature a path belongs to — usually none or one, but e.g.
     * /plans/nutrition/templates is both `nutrition` and `templates`.
     *
     * @return string[]
     */
    public static function forPath(string $path): array
    {
        $keys = [];
        foreach (self::CATALOG as $key => $meta) {
            foreach ($meta['routes'] as $pattern) {
                if (preg_match($pattern, $path) === 1) {
                    $keys[] = $key;
                    break;
                }
            }
        }
        return $keys;
    }

    /** Whether the section is on for someone of this account type. */
    public static function enabledFor(string $key, ?string $role): bool
    {
        $state = Settings::get('features')[$key] ?? null;
        if ($state === null) {
            return true;
        }
        if (!$state['enabled']) {
            return false;
        }
        return $role === null || ($state['roles'][$role] ?? true);
    }

    /** On for everyone — the common case, which needs no user lookup. */
    public static function fullyEnabled(string $key): bool
    {
        $state = Settings::get('features')[$key] ?? null;
        if ($state === null) {
            return true;
        }
        return $state['enabled'] && !in_array(false, $state['roles'], true);
    }

    public static function label(string $key): string
    {
        return self::CATALOG[$key]['label'] ?? $key;
    }
}
