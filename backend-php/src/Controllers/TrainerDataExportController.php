<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Jalali;
use Gymlic\Response;
use Gymlic\TrainingWeek;
use Gymlic\Xlsx;
use PDO;

/**
 * «دریافت همه‌ی اطلاعات»: every piece of the trainer's own data as one
 * .xlsx, a sheet per kind. A right of the trainer, not a plan feature: open
 * on every plan, free included, in the grace days and after, whatever the
 * admin's enforcement switch says; the downgrade rules lean on it. Only a
 * technical limit: one export per trainer every 10 minutes.
 *
 * Raw data, not statistics: separate from the reports page's Excel export
 * (ReportExportController, report level full_excel), and kept separate.
 *
 * Everything the trainer made or recorded, hidden or not: the plan history
 * limit (Limits::historyVisibleSql, phase 3) is deliberately not applied,
 * and athletes suspended by the plan or by hand are included with their
 * status. Only the trainer's own: in a club, their own athletes and plans,
 * not the club's or other trainers'. Platform subscription payments and
 * discount codes are left out.
 *
 * It streams (Xlsx), each sheet read unbuffered, so a trainer with years of
 * data needs one row in memory at a time and no time limit is hit.
 */
final class TrainerDataExportController
{
    private const EVERY_MINUTES = 10;

    private const PLAN_STATUS = ['active' => 'فعال', 'completed' => 'تمام‌شده', 'cancelled' => 'لغوشده', 'draft' => 'پیش‌نویس'];

    private const METHOD = ['cash' => 'نقدی', 'card_transfer' => 'کارت‌به‌کارت', 'online' => 'آنلاین'];

    public static function download(): void
    {
        $user = Auth::requireUser();
        if ($user['account_type'] !== 'trainer') {
            Response::error(403, 'forbidden', 'این خروجی فقط برای مربی است.');
            return;
        }
        $pdo = Database::connection();
        $trainerId = $user['id'];

        // One every 10 minutes: checked and logged under a lock on the
        // trainer's row, so two clicks at once make one file, not two.
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM profiles WHERE id = :id FOR UPDATE')->execute(['id' => $trainerId]);
            $last = $pdo->prepare(
                "SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) FROM activity_logs
                 WHERE actor_id = :t AND action = 'trainer_data_export' AND created_at > NOW() - INTERVAL " . self::EVERY_MINUTES . ' MINUTE
                 ORDER BY created_at DESC LIMIT 1'
            );
            $last->execute(['t' => $trainerId]);
            $ago = $last->fetchColumn();
            if ($ago !== false) {
                $pdo->rollBack();
                $wait = max(1, (int) ceil((self::EVERY_MINUTES * 60 - (int) $ago) / 60));
                header('Retry-After: ' . ($wait * 60));
                Response::error(429, 'export_too_soon', 'هر ' . self::fa(self::EVERY_MINUTES) . ' دقیقه یک بار می‌توانید خروجی بگیرید. '
                    . self::fa($wait) . ' دقیقه‌ی دیگر دوباره امتحان کنید.');
                return;
            }
            $sheets = self::sheets($trainerId);
            AdminController::logActivity($pdo, null, $trainerId, $trainerId, 'trainer_data_export', [
                'sheets' => count($sheets),
            ]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        @set_time_limit(0);
        ReportExportController::sendHeaders('gymlic-data-' . str_replace('/', '-', Jalali::format(TrainingWeek::today())) . '.xlsx');
        $xlsx = new Xlsx(static function (string $bytes): void {
            echo $bytes;
        });
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
        try {
            foreach ($sheets as [$name, $header, $widths, $sql, $map]) {
                $xlsx->sheet($name, self::rows($pdo, $header, $sql, $trainerId, $map), $widths);
            }
            $xlsx->finish();
        } finally {
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        }
    }

    /**
     * The header, then each row of $sql (bound to :t, the trainer) through
     * $map, which returns one row or a list of rows. Read unbuffered: the
     * statement is finished before the next sheet.
     *
     * @param list<string> $header
     * @param callable(array<string, mixed>): list<string|int|float|null> $map
     * @return \Generator<list<string|int|float|null>>
     */
    private static function rows(PDO $pdo, array $header, string $sql, string $trainerId, callable $map): \Generator
    {
        yield $header;
        // Real prepares can't repeat a placeholder: each :t becomes :t1, :t2, …
        $bind = [];
        $sql = (string) preg_replace_callback('/:t\b/', static function () use (&$bind, $trainerId): string {
            $key = 't' . (count($bind) + 1);
            $bind[$key] = $trainerId;
            return ':' . $key;
        }, $sql);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);
        while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
            $mapped = $map($row);
            if ($mapped === []) {
                continue;
            }
            if (is_array($mapped[0] ?? null)) {
                yield from $mapped;
            } else {
                yield $mapped;
            }
        }
        $stmt->closeCursor();
    }

    /**
     * The sheets this database can fill: a table an update hasn't created
     * yet is simply left out. Each: name, header, widths, SQL bound to :t,
     * row mapper.
     *
     * @return list<array{0: string, 1: list<string>, 2: list<int>, 3: string, 4: callable}>
     */
    private static function sheets(string $trainerId): array
    {
        $has = static fn (string ...$tables): bool => array_reduce($tables, static fn (bool $ok, string $t) => $ok && Database::hasTable($t), true);
        $name = static fn (array $r, string $prefix = ''): string => trim(($r[$prefix . 'first_name'] ?? '') . ' ' . ($r[$prefix . 'last_name'] ?? ''));
        // The trainer's athletes, current or not (the link row stays).
        $mine = 'SELECT athlete_id FROM trainer_athletes WHERE trainer_id = :t';
        $out = [];

        $hasClubCol = Database::hasColumn('trainer_athletes', 'club_id');
        $hasSuspendCol = Database::hasColumn('trainer_athletes', 'suspended_by_plan');
        $out[] = ['ورزشکاران',
            ['نام', 'تلفن', 'ایمیل', 'تاریخ تولد', 'وضعیت', 'از تاریخ', 'باشگاه', 'یادداشت'],
            [24, 16, 26, 14, 18, 14, 20, 30],
            'SELECT p.first_name, p.last_name, p.phone, p.email, p.birth_date, ta.status, ta.created_at, ta.note'
                . ($hasSuspendCol ? ', ta.suspended_by_plan' : ', 0 AS suspended_by_plan')
                . ($hasClubCol ? ', c.name AS club_name' : ', NULL AS club_name') . '
             FROM trainer_athletes ta JOIN profiles p ON p.id = ta.athlete_id'
                . ($hasClubCol ? ' LEFT JOIN clubs c ON c.id = ta.club_id' : '') . '
             WHERE ta.trainer_id = :t ORDER BY ta.created_at',
            static fn (array $r) => [
                $name($r), $r['phone'], $r['email'], Jalali::format($r['birth_date']),
                match (true) {
                    (int) $r['suspended_by_plan'] === 1 => 'غیرفعال با پایان پلن',
                    $r['status'] === 'suspended' => 'معلق',
                    $r['status'] === 'pending' => 'در انتظار',
                    default => 'فعال',
                },
                Jalali::format($r['created_at']), $r['club_name'], $r['note'],
            ],
        ];

        // Plans and templates: every one, the history limit not applied.
        foreach (['workout' => ['workout_assignments', 'برنامه‌های تمرینی'], 'nutrition' => ['nutrition_assignments', 'برنامه‌های غذایی']] as [$table, $title]) {
            $out[] = [$title,
                ['عنوان', 'ورزشکار', 'وضعیت', 'تاریخ', 'آخرین ویرایش', 'شرح'],
                [28, 22, 12, 14, 14, 60],
                "SELECT a.title, a.status, a.assigned_at, a.updated_at, a.description, p.first_name, p.last_name
                 FROM {$table} a LEFT JOIN profiles p ON p.id = a.athlete_id
                 WHERE a.trainer_id = :t AND a.is_template = 0 ORDER BY a.assigned_at",
                static fn (array $r) => [$r['title'], $name($r), self::PLAN_STATUS[$r['status']] ?? $r['status'],
                    Jalali::format($r['assigned_at']), Jalali::format($r['updated_at']), $r['description']],
            ];
        }

        if ($has('supplement_assignments', 'supplement_plan_items', 'supplements')) {
            $out[] = ['برنامه‌های مکمل',
                ['عنوان', 'ورزشکار', 'وضعیت', 'تاریخ', 'مکمل', 'مقدار', 'زمان مصرف', 'توضیح'],
                [24, 22, 12, 14, 24, 14, 16, 30],
                'SELECT a.title, a.status, a.created_at, p.first_name, p.last_name, s.name AS supplement, i.dose, i.timing, i.custom_time, i.note
                 FROM supplement_assignments a LEFT JOIN profiles p ON p.id = a.athlete_id
                 LEFT JOIN supplement_plan_items i ON i.assignment_id = a.id
                 LEFT JOIN supplements s ON s.id = i.supplement_id
                 WHERE a.trainer_id = :t ORDER BY a.created_at, a.id, i.sort_order',
                static fn (array $r) => [$r['title'], $name($r), self::PLAN_STATUS[$r['status']] ?? $r['status'], Jalali::format($r['created_at']),
                    $r['supplement'], $r['dose'], self::timing($r['timing'], $r['custom_time']), $r['note']],
            ];
        }

        $out[] = ['قالب‌ها',
            ['نوع', 'عنوان', 'تاریخ', 'شرح'],
            [12, 28, 14, 60],
            "SELECT 'تمرینی' AS kind, title, assigned_at, description FROM workout_assignments WHERE trainer_id = :t AND is_template = 1
             UNION ALL
             SELECT 'غذایی', title, assigned_at, description FROM nutrition_assignments WHERE trainer_id = :t AND is_template = 1
             ORDER BY assigned_at",
            static fn (array $r) => [$r['kind'], $r['title'], Jalali::format($r['assigned_at']), $r['description']],
        ];

        // What a plan made with the builder holds, row by row (templates too).
        if ($has('workout_plan_days', 'workout_plan_exercises')) {
            $technique = Database::hasColumn('workout_plan_exercises', 'technique_id') && $has('techniques');
            $out[] = ['جزئیات برنامه‌های تمرینی',
                ['برنامه', 'قالب', 'هفته', 'روز', 'حرکت', 'ست', 'تکرار', 'وزنه (کیلوگرم)', 'استراحت (ثانیه)', 'تکنیک', 'توضیح'],
                [28, 8, 8, 16, 26, 6, 10, 14, 14, 16, 30],
                'SELECT a.title, a.is_template, d.week_number, d.day_name, d.day_number, e.name AS exercise, x.sets, x.reps, x.weight_kg, x.rest_seconds, x.note'
                    . ($technique ? ', tq.name AS technique' : ', NULL AS technique') . '
                 FROM workout_assignments a
                 JOIN workout_plan_days d ON d.assignment_id = a.id
                 JOIN workout_plan_exercises x ON x.day_id = d.id
                 LEFT JOIN exercises e ON e.id = x.exercise_id'
                    . ($technique ? ' LEFT JOIN techniques tq ON tq.id = x.technique_id' : '') . '
                 WHERE a.trainer_id = :t
                 ORDER BY a.assigned_at, a.id, d.week_number, d.sort_order, x.sort_order',
                static fn (array $r) => [$r['title'], (int) $r['is_template'] === 1 ? 'بله' : null, self::num($r['week_number']),
                    $r['day_name'] ?: ('روز ' . $r['day_number']), $r['exercise'], self::num($r['sets']), $r['reps'],
                    self::num($r['weight_kg']), self::num($r['rest_seconds']), $r['technique'], $r['note']],
            ];
        }
        if ($has('nutrition_plan_meals', 'nutrition_plan_items', 'foods')) {
            $out[] = ['جزئیات برنامه‌های غذایی',
                ['برنامه', 'قالب', 'وعده', 'غذا', 'مقدار', 'واحد', 'توضیح'],
                [28, 8, 18, 26, 10, 12, 30],
                'SELECT a.title, a.is_template, m.meal_name, f.name AS food, i.amount, i.unit, i.note
                 FROM nutrition_assignments a
                 JOIN nutrition_plan_meals m ON m.assignment_id = a.id
                 JOIN nutrition_plan_items i ON i.meal_id = m.id
                 LEFT JOIN foods f ON f.id = i.food_id
                 WHERE a.trainer_id = :t
                 ORDER BY a.assigned_at, a.id, m.sort_order, i.sort_order',
                static fn (array $r) => [$r['title'], (int) $r['is_template'] === 1 ? 'بله' : null, $r['meal_name'], $r['food'],
                    self::num($r['amount']), $r['unit'], $r['note']],
            ];
        }

        // The trainer's own library items, all of them (above a plan's cap too).
        $custom = ["SELECT 'حرکت' AS kind, name, name_en, muscle_group AS detail, description, created_at FROM exercises WHERE created_by = :t"];
        if ($has('foods')) {
            $custom[] = "SELECT 'غذا', name, name_en, category, description, created_at FROM foods WHERE created_by = :t";
        }
        if ($has('supplements')) {
            $custom[] = "SELECT 'مکمل', name, name_en, NULL, description, created_at FROM supplements WHERE created_by = :t";
        }
        if ($has('techniques')) {
            $custom[] = "SELECT 'تکنیک', name, NULL, NULL, description, created_at FROM techniques WHERE coach_id = :t";
        }
        $out[] = ['حرکت‌ها و موارد سفارشی',
            ['نوع', 'نام', 'نام انگلیسی', 'گروه', 'توضیح', 'تاریخ'],
            [10, 26, 22, 16, 50, 14],
            implode(' UNION ALL ', $custom) . ' ORDER BY created_at',
            static fn (array $r) => [$r['kind'], $r['name'], $r['name_en'], $r['detail'], $r['description'], Jalali::format($r['created_at'])],
        ];

        $out[] = ['اندازه‌گیری‌ها',
            ['ورزشکار', 'تاریخ', 'قد (سانتی‌متر)', 'وزن (کیلوگرم)', 'BMI', 'چربی (٪)', 'دور کمر (سانتی‌متر)', 'دور سینه (سانتی‌متر)', 'یادداشت'],
            [22, 14, 14, 14, 8, 10, 18, 18, 30],
            "SELECT p.first_name, p.last_name, m.recorded_at, m.height_cm, m.weight_kg, m.body_fat_percent, m.waist_cm, m.chest_cm, m.note
             FROM measurements m JOIN profiles p ON p.id = m.athlete_id
             WHERE m.athlete_id IN ({$mine}) ORDER BY p.last_name, p.first_name, m.recorded_at",
            static fn (array $r) => [$name($r), Jalali::format($r['recorded_at']), self::num($r['height_cm']), self::num($r['weight_kg']),
                self::bmi($r['weight_kg'], $r['height_cm']), self::num($r['body_fat_percent']), self::num($r['waist_cm']), self::num($r['chest_cm']), $r['note']],
        ];

        if ($has('trainer_payments')) {
            $method = Database::hasColumn('trainer_payments', 'payment_method');
            $out[] = ['درآمد من',
                ['ورزشکار', 'مبلغ (تومان)', 'روش پرداخت', 'تاریخ پرداخت', 'توضیح'],
                [22, 16, 14, 14, 30],
                'SELECT p.first_name, p.last_name, tp.amount_toman, tp.paid_at, tp.note' . ($method ? ', tp.payment_method' : ", 'cash' AS payment_method") . '
                 FROM trainer_payments tp LEFT JOIN profiles p ON p.id = tp.athlete_id
                 WHERE tp.trainer_id = :t ORDER BY tp.paid_at',
                static fn (array $r) => [$name($r), self::num($r['amount_toman']), self::METHOD[$r['payment_method']] ?? $r['payment_method'],
                    Jalali::format($r['paid_at']), $r['note']],
            ];
        }
        if ($has('invoices')) {
            $out[] = ['فاکتورها',
                ['ورزشکار', 'بابت', 'مبلغ (تومان)', 'وضعیت', 'روش پرداخت', 'تاریخ پرداخت', 'تاریخ صدور', 'توضیح'],
                [22, 16, 16, 14, 14, 14, 14, 30],
                'SELECT p.first_name, p.last_name, i.item_type, i.amount_toman, i.status, i.payment_method, i.paid_at, i.created_at, i.note
                 FROM invoices i LEFT JOIN profiles p ON p.id = i.athlete_id
                 WHERE i.trainer_id = :t ORDER BY i.created_at',
                static fn (array $r) => [$name($r),
                    ['workout_plan' => 'برنامه‌ی تمرینی', 'nutrition_plan' => 'برنامه‌ی غذایی', 'session_package' => 'بسته‌ی جلسه', 'questionnaire' => 'پرسشنامه'][$r['item_type']] ?? $r['item_type'],
                    self::num($r['amount_toman']), ['pending' => 'در انتظار پرداخت', 'paid' => 'پرداخت‌شده', 'cancelled' => 'لغوشده'][$r['status']] ?? $r['status'],
                    self::METHOD[$r['payment_method'] ?? ''] ?? null, Jalali::format($r['paid_at']), Jalali::format($r['created_at']), $r['note']],
            ];
        }
        if ($has('session_packages')) {
            $sessions = $has('package_sessions');
            $out[] = ['بسته‌های جلسه',
                ['ورزشکار', 'عنوان', 'تعداد جلسه', 'جلسه‌ی انجام‌شده', 'قیمت (تومان)', 'تخفیف (تومان)', 'وضعیت', 'تاریخ'],
                [22, 24, 12, 14, 16, 16, 16, 14],
                'SELECT p.first_name, p.last_name, sp.title, sp.total_sessions, sp.price_toman, sp.discount_toman, sp.status, sp.created_at'
                    . ($sessions ? ", (SELECT COUNT(*) FROM package_sessions ps WHERE ps.package_id = sp.id AND ps.status = 'done') AS done" : ', NULL AS done') . '
                 FROM session_packages sp LEFT JOIN profiles p ON p.id = sp.athlete_id
                 WHERE sp.trainer_id = :t ORDER BY sp.created_at',
                static fn (array $r) => [$name($r), $r['title'], self::num($r['total_sessions']), self::num($r['done']), self::num($r['price_toman']),
                    self::num($r['discount_toman']),
                    ['pending_payment' => 'در انتظار پرداخت', 'active' => 'فعال', 'completed' => 'تمام‌شده', 'cancelled' => 'لغوشده'][$r['status']] ?? $r['status'],
                    Jalali::format($r['created_at'])],
            ];
        }

        // Comments on the trainer's plans (messages attached to a plan), both sides.
        if (Database::hasColumn('messages', 'plan_id')) {
            $out[] = ['کامنت‌های برنامه‌ها',
                ['برنامه', 'فرستنده', 'متن', 'پیوست', 'تاریخ', 'ساعت'],
                [28, 22, 60, 26, 14, 8],
                "SELECT COALESCE(w.title, n.title) AS plan, s.first_name, s.last_name, m.body, m.media_name, m.created_at
                 FROM messages m
                 LEFT JOIN workout_assignments w ON m.plan_kind = 'workout' AND w.id = m.plan_id
                 LEFT JOIN nutrition_assignments n ON m.plan_kind = 'nutrition' AND n.id = m.plan_id
                 JOIN profiles s ON s.id = m.sender_id
                 WHERE m.plan_id IS NOT NULL AND (w.trainer_id = :t OR n.trainer_id = :t)
                 ORDER BY m.created_at",
                static fn (array $r) => [$r['plan'], $name($r), $r['body'], $r['media_name'], Jalali::format($r['created_at']), substr((string) $r['created_at'], 11, 5)],
            ];
        }

        if ($has('notes')) {
            $out[] = ['یادداشت‌ها',
                ['ورزشکار', 'یادداشت', 'تاریخ', 'آخرین ویرایش'],
                [22, 70, 14, 14],
                'SELECT p.first_name, p.last_name, nt.content, nt.created_at, nt.updated_at
                 FROM notes nt LEFT JOIN profiles p ON p.id = nt.athlete_id
                 WHERE nt.trainer_id = :t ORDER BY nt.created_at',
                static fn (array $r) => [$name($r) ?: 'عمومی', $r['content'], Jalali::format($r['created_at']), Jalali::format($r['updated_at'])],
            ];
        }
        if ($has('calendar_events')) {
            $out[] = ['تقویم',
                ['عنوان', 'ورزشکار', 'تاریخ', 'ساعت', 'تکرار', 'توضیح'],
                [26, 22, 14, 8, 14, 30],
                'SELECT ce.title, ce.event_date, ce.start_time, ce.recurrence_rule, ce.notes, p.first_name, p.last_name
                 FROM calendar_events ce LEFT JOIN profiles p ON p.id = ce.athlete_id
                 WHERE ce.trainer_id = :t ORDER BY ce.event_date, ce.start_time',
                static fn (array $r) => [$r['title'], $name($r), Jalali::format($r['event_date']), $r['start_time'] !== null ? substr((string) $r['start_time'], 0, 5) : null,
                    self::recurrence($r['recurrence_rule']), $r['notes']],
            ];
        }
        if ($has('workout_day_logs')) {
            $out[] = ['تمرین‌های انجام‌شده',
                ['ورزشکار', 'برنامه', 'روز', 'تاریخ انجام'],
                [22, 28, 18, 14],
                'SELECT p.first_name, p.last_name, a.title, l.day_key, l.completed_on
                 FROM workout_day_logs l JOIN workout_assignments a ON a.id = l.assignment_id
                 JOIN profiles p ON p.id = l.athlete_id
                 WHERE a.trainer_id = :t ORDER BY l.completed_on',
                static fn (array $r) => [$name($r), $r['title'], $r['day_key'], Jalali::format($r['completed_on'])],
            ];
        }
        if ($has('questionnaires')) {
            $responses = $has('questionnaire_responses');
            $out[] = ['پرسشنامه‌ها',
                ['عنوان', 'توضیح', 'قیمت (تومان)', 'فعال', 'پاسخ‌ها', 'تاریخ'],
                [26, 40, 14, 8, 10, 14],
                'SELECT q.title, q.description, q.price_toman, q.is_active, q.created_at'
                    . ($responses ? ', (SELECT COUNT(*) FROM questionnaire_responses r WHERE r.questionnaire_id = q.id) AS responses' : ', NULL AS responses') . '
                 FROM questionnaires q WHERE q.coach_id = :t ORDER BY q.created_at',
                static fn (array $r) => [$r['title'], $r['description'], self::num($r['price_toman']), (int) $r['is_active'] === 1 ? 'بله' : 'خیر',
                    self::num($r['responses']), Jalali::format($r['created_at'])],
            ];
        }
        if ($has('trainer_profiles')) {
            $out[] = ['رزومه',
                ['بخش', 'متن'],
                [18, 80],
                'SELECT bio, achievements, certificates, pricing_table, social_links FROM trainer_profiles WHERE trainer_id = :t',
                static fn (array $r) => array_values(array_filter([
                    $r['bio'] ? ['درباره‌ی من', $r['bio']] : null,
                    self::listText('افتخارات', $r['achievements']),
                    self::listText('مدارک', $r['certificates']),
                    self::listText('تعرفه‌ها', $r['pricing_table']),
                    self::listText('شبکه‌های اجتماعی', $r['social_links']),
                ])),
            ];
        }

        return $out;
    }

    /** @return array{0: string, 1: string}|null a JSON list (or text) as readable lines, beside its title */
    private static function listText(string $title, mixed $value): ?array
    {
        if ($value === null || $value === '' || $value === '[]' || $value === '{}') {
            return null;
        }
        $data = json_decode((string) $value, true);
        if (!is_array($data)) {
            return [$title, (string) $value];
        }
        $lines = [];
        array_walk_recursive($data, static function ($v, $k) use (&$lines): void {
            if ($v !== null && $v !== '') {
                $lines[] = (is_string($k) ? $k . ': ' : '') . $v;
            }
        });
        return $lines === [] ? null : [$title, implode("\n", $lines)];
    }

    /** «هفتگی», «هر ۲ هفته» from a Recurrence rule ('w/2:1,3'); null when it doesn't repeat. */
    private static function recurrence(?string $rule): ?string
    {
        if ($rule === null || $rule === '') {
            return null;
        }
        if (!preg_match('/^([dwmy])(?:\/(\d+))?/', $rule, $m)) {
            return 'هفتگی'; // the old weekday-list form, "1,3,5"
        }
        $unit = ['d' => ['روزانه', 'روز'], 'w' => ['هفتگی', 'هفته'], 'm' => ['ماهانه', 'ماه'], 'y' => ['سالانه', 'سال']][$m[1]];
        $every = (int) ($m[2] ?? 1);
        return $every > 1 ? 'هر ' . self::fa($every) . ' ' . $unit[1] : $unit[0];
    }

    private static function timing(?string $timing, ?string $custom): ?string
    {
        return match ($timing) {
            'before_workout' => 'قبل از تمرین',
            'after_workout'  => 'بعد از تمرین',
            'breakfast'      => 'صبحانه',
            'lunch'          => 'ناهار',
            'dinner'         => 'شام',
            'before_sleep'   => 'قبل از خواب',
            'custom'         => $custom !== null ? substr($custom, 0, 5) : 'دلخواه',
            default          => $timing,
        };
    }

    /** BMI from kg and cm, one decimal; null without both. */
    private static function bmi(mixed $kg, mixed $cm): ?float
    {
        $kg = (float) $kg;
        $m = (float) $cm / 100;
        return $kg > 0 && $m > 0 ? round($kg / ($m * $m), 1) : null;
    }

    /** A stored number as a number cell (int when whole), null stays empty. */
    private static function num(mixed $value): int|float|null
    {
        if ($value === null || $value === '') {
            return null;
        }
        $f = (float) $value;
        return floor($f) === $f && abs($f) < PHP_INT_MAX ? (int) $f : $f;
    }

    private static function fa(int $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
