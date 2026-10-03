<?php
declare(strict_types=1);

namespace Gymlic;

use Gymlic\Controllers\AuthController;
use PDO;

/**
 * The text of every automatic notification (and the SMS/email copy made
 * from it), editable from /admin/templates instead of from code.
 *
 * Each call site names a template and hands over its values; the stored
 * override (settings group `templates`) replaces the title or body, and an
 * empty one means the default below. A template the admin switched off is
 * not sent at all. Placeholders are {name}; one the text doesn't use is
 * simply left out, and one the text has but the call didn't supply stays
 * visible, which makes a typo obvious in the admin's own test.
 */
final class Templates
{
    public const GROUPS = [
        'account'   => 'حساب و باشگاه',
        'billing'   => 'اشتراک باشگاه',
        'coaching'  => 'مربی و ورزشکار',
        'invoices'  => 'فاکتورها',
        'reminders' => 'یادآورها',
        'messages'  => 'پیام و تیکت',
        'support'   => 'پشتیبانی',
    ];

    /**
     * key => group, label, to (who receives it), title, body, vars (placeholder => meaning).
     *
     * @var array<string, array{group: string, label: string, to: string, title: string, body: string, vars: array<string, string>}>
     */
    public const CATALOG = [
        // ---- account
        'complete_profile' => [
            'group' => 'account', 'label' => 'خوش‌آمد و تکمیل پروفایل', 'to' => 'کاربر تازه',
            'title' => 'تکمیل پروفایل', 'body' => 'برای شروع، پروفایل خود را تکمیل کنید.', 'vars' => [],
        ],
        'account_suspended' => [
            'group' => 'account', 'label' => 'تعلیق حساب', 'to' => 'کاربر',
            'title' => 'حساب شما تعلیق شد', 'body' => 'حساب کاربری شما تعلیق شد. برای پیگیری با پشتیبانی تماس بگیرید.', 'vars' => [],
        ],
        'account_activated' => [
            'group' => 'account', 'label' => 'رفع تعلیق حساب', 'to' => 'کاربر',
            'title' => 'حساب شما فعال شد', 'body' => 'حساب کاربری شما دوباره فعال شد و می‌توانید وارد شوید.', 'vars' => [],
        ],
        'club_suspended' => [
            'group' => 'account', 'label' => 'تعلیق باشگاه', 'to' => 'مالک باشگاه',
            'title' => 'باشگاه شما تعلیق شد', 'body' => 'باشگاه «{club}» تعلیق شد. برای پیگیری با پشتیبانی تماس بگیرید.',
            'vars' => ['club' => 'نام باشگاه'],
        ],
        'club_activated' => [
            'group' => 'account', 'label' => 'فعال‌شدن باشگاه', 'to' => 'مالک باشگاه',
            'title' => 'باشگاه شما فعال شد', 'body' => 'باشگاه «{club}» دوباره فعال شد.', 'vars' => ['club' => 'نام باشگاه'],
        ],
        'member_payment_submitted' => [
            'group' => 'account', 'label' => 'ثبت پرداخت شهریه توسط ورزشکار', 'to' => 'مالک و پذیرش باشگاه',
            'title' => 'پرداخت شهریهٔ جدید', 'body' => '{name} پرداخت طرح «{plan}» را برای تأیید ثبت کرد.',
            'vars' => ['name' => 'نام ورزشکار', 'plan' => 'نام طرح عضویت'],
        ],
        'member_payment_approved' => [
            'group' => 'account', 'label' => 'تأیید پرداخت شهریه', 'to' => 'ورزشکار',
            'title' => 'پرداخت شما تأیید شد', 'body' => 'عضویت شما در باشگاه «{club}» تا {date} تمدید شد.',
            'vars' => ['club' => 'نام باشگاه', 'date' => 'تاریخ انقضای عضویت'],
        ],
        'member_payment_rejected' => [
            'group' => 'account', 'label' => 'رد پرداخت شهریه', 'to' => 'ورزشکار',
            'title' => 'پرداخت شما تأیید نشد', 'body' => 'باشگاه «{club}» پرداخت ثبت‌شدهٔ شما را تأیید نکرد. {reason}',
            'vars' => ['club' => 'نام باشگاه', 'reason' => 'دلیل باشگاه، یا «برای پیگیری با باشگاه صحبت کنید.»'],
        ],
        'member_joined' => [
            'group' => 'account', 'label' => 'عضو جدید باشگاه', 'to' => 'کسی که دعوت را فرستاده',
            'title' => 'عضو جدید', 'body' => '{name} به باشگاه پیوست.', 'vars' => ['name' => 'نام عضو'],
        ],
        'invitation_accepted' => [
            'group' => 'account', 'label' => 'پذیرفتن دعوت', 'to' => 'کسی که دعوت را فرستاده',
            'title' => 'دعوت پذیرفته شد', 'body' => '{name} دعوت شما را پذیرفت.', 'vars' => ['name' => 'نام دعوت‌شده'],
        ],
        'membership_removed' => [
            'group' => 'account', 'label' => 'پایان عضویت در باشگاه', 'to' => 'عضو',
            'title' => 'پایان عضویت', 'body' => 'عضویت شما در باشگاه «{club}» پایان یافت.', 'vars' => ['club' => 'نام باشگاه'],
        ],
        'club_trainer_removed' => [
            'group' => 'account', 'label' => 'پایان همکاری مربی با باشگاه', 'to' => 'مربی',
            'title' => 'پایان همکاری', 'body' => 'همکاری شما با باشگاه «{club}» پایان یافت.', 'vars' => ['club' => 'نام باشگاه'],
        ],

        // ---- billing
        'payment_submitted' => [
            'group' => 'billing', 'label' => 'ثبت درخواست پرداخت اشتراک', 'to' => 'مدیرانِ بررسی‌کنندهٔ پرداخت',
            'title' => 'درخواست پرداخت جدید', 'body' => 'باشگاه «{club}» پرداخت {amount} تومان را برای بررسی ثبت کرد.',
            'vars' => ['club' => 'نام باشگاه', 'amount' => 'مبلغ به تومان'],
        ],
        'payment_approved' => [
            'group' => 'billing', 'label' => 'تأیید پرداخت اشتراک', 'to' => 'مالک باشگاه',
            'title' => 'پرداخت تأیید شد', 'body' => 'اشتراک باشگاه شما تا {date} فعال شد.', 'vars' => ['date' => 'تاریخ انقضا'],
        ],
        'payment_rejected' => [
            'group' => 'billing', 'label' => 'رد پرداخت اشتراک', 'to' => 'مالک باشگاه',
            'title' => 'پرداخت رد شد', 'body' => 'درخواست پرداخت اشتراک شما رد شد. {reason}',
            'vars' => ['reason' => 'یادداشت مدیر، یا «برای پیگیری با پشتیبانی تماس بگیرید.»'],
        ],
        'trainer_payment_submitted' => [
            'group' => 'billing', 'label' => 'ثبت پرداخت اشتراک مربی', 'to' => 'مدیرانِ بررسی‌کنندهٔ پرداخت',
            'title' => 'پرداخت اشتراک مربی', 'body' => '{name} پرداخت {amount} تومان را برای اشتراک مربی ثبت کرد.',
            'vars' => ['name' => 'نام مربی', 'amount' => 'مبلغ به تومان'],
        ],
        'trainer_payment_approved' => [
            'group' => 'billing', 'label' => 'تأیید پرداخت اشتراک مربی', 'to' => 'مربی',
            'title' => 'پرداخت تأیید شد', 'body' => 'اشتراک شما تا {date} فعال شد.', 'vars' => ['date' => 'تاریخ انقضا'],
        ],
        'trainer_payment_rejected' => [
            'group' => 'billing', 'label' => 'رد پرداخت اشتراک مربی', 'to' => 'مربی',
            'title' => 'پرداخت رد شد', 'body' => 'پرداخت اشتراک شما تأیید نشد. {reason}',
            'vars' => ['reason' => 'یادداشت مدیر، یا «برای پیگیری با پشتیبانی تماس بگیرید.»'],
        ],
        'payment_review_waiting' => [
            'group' => 'billing', 'label' => 'یادآور پرداخت‌های بی‌پاسخ', 'to' => 'بررسی‌کنندهٔ پرداخت (مدیر، مربی یا باشگاه)',
            'title' => 'پرداخت‌های در انتظار بررسی', 'body' => '{count} پرداخت منتظر بررسی شماست؛ قدیمی‌ترین‌شان {days} روز است که پاسخی نگرفته.',
            'vars' => ['count' => 'تعداد درخواست‌ها', 'days' => 'روزهای انتظار قدیمی‌ترین'],
        ],
        'trainer_subscription_expiring' => [
            'group' => 'billing', 'label' => 'نزدیک شدن پایان اشتراک مربی', 'to' => 'مربی',
            'title' => 'اشتراک شما رو به پایان است', 'body' => 'اشتراک شما تا {date} ({days} روز دیگر) فعال است. برای تمدید، از «اشتراک من» اقدام کنید.',
            'vars' => ['date' => 'تاریخ انقضا', 'days' => 'روز مانده'],
        ],
        'trainer_subscription_expired' => [
            'group' => 'billing', 'label' => 'پایان اشتراک مربی', 'to' => 'مربی',
            'title' => 'اشتراک شما تمام شد', 'body' => 'اشتراک شما در تاریخ {date} تمام شد. تا {grace_date} همه‌چیز مثل قبل کار می‌کند؛ بعد از آن محدودیت‌های پلن رایگان اعمال می‌شود. برای ادامه، از «اشتراک من» تمدید کنید. همه‌ی اطلاعاتتان را هر زمان از «تنظیمات» دریافت کنید.',
            'vars' => ['date' => 'تاریخ انقضا', 'grace_date' => 'پایان مهلت پس از انقضا'],
        ],
        'trainer_athletes_suspended' => [
            'group' => 'billing', 'label' => 'غیرفعال شدن ورزشکاران پس از پایان مهلت', 'to' => 'مربی',
            'title' => 'برخی ورزشکاران غیرفعال شدند', 'body' => 'مهلت اشتراک شما تمام شد و پلن رایگان تا {cap} ورزشکار فعال دارد؛ {count} ورزشکار غیرفعال شدند (حذف نشده‌اند). می‌توانید انتخاب کنید کدام‌ها فعال بمانند، یا با تمدید همه را برگردانید. همه‌ی اطلاعاتتان را هر زمان از «تنظیمات» دریافت کنید.',
            'vars' => ['count' => 'تعداد ورزشکار غیرفعال', 'cap' => 'سقف پلن رایگان'],
        ],
        'trainer_subscription_changed' => [
            'group' => 'billing', 'label' => 'تغییر دستی اشتراک مربی', 'to' => 'مربی',
            'title' => 'اشتراک شما به‌روزرسانی شد', 'body' => 'اشتراک شما با پلن «{plan}» تا {date} تنظیم شد.',
            'vars' => ['plan' => 'نام پلن', 'date' => 'تاریخ انقضا'],
        ],
        'invitation_limit_reached' => [
            'group' => 'billing', 'label' => 'رد دعوت به‌خاطر پر بودن ظرفیت', 'to' => 'فرستندهٔ دعوت',
            'title' => 'دعوت پذیرفته نشد', 'body' => '{name} خواست دعوت شما را بپذیرد، ولی ظرفیت پلن پر است و دعوت باطل شد. برای ظرفیت بیشتر، پلن را ارتقا دهید.',
            'vars' => ['name' => 'نام دعوت‌شده'],
        ],
        'trainer_subscription_granted' => [
            'group' => 'billing', 'label' => 'تمدید دستی اشتراک مربی', 'to' => 'مربی',
            'title' => 'اشتراک شما تمدید شد', 'body' => 'اشتراک شما تا {date} تمدید شد.', 'vars' => ['date' => 'تاریخ انقضا'],
        ],
        'subscription_renewed' => [
            'group' => 'billing', 'label' => 'تمدید دستی اشتراک', 'to' => 'مالک باشگاه',
            'title' => 'اشتراک باشگاه تمدید شد', 'body' => 'اشتراک «{plan}» باشگاه شما تا {date} تمدید شد.',
            'vars' => ['plan' => 'نام پلن', 'date' => 'تاریخ انقضا'],
        ],
        'subscription_gifted' => [
            'group' => 'billing', 'label' => 'روز هدیه', 'to' => 'مالک باشگاه',
            'title' => 'روز هدیه به اشتراک شما اضافه شد', 'body' => '{days} روز هدیه به اشتراک باشگاه شما اضافه شد؛ اشتراک تا {date} فعال است. {note}',
            'vars' => ['days' => 'تعداد روز', 'date' => 'تاریخ انقضا', 'note' => 'توضیح مدیر'],
        ],
        'subscription_set' => [
            'group' => 'billing', 'label' => 'تنظیم دستی اشتراک', 'to' => 'مالک باشگاه',
            'title' => 'اشتراک باشگاه به‌روزرسانی شد', 'body' => 'اشتراک «{plan}» باشگاه شما تا {date} فعال است.',
            'vars' => ['plan' => 'نام پلن', 'date' => 'تاریخ انقضا'],
        ],
        'subscription_ended' => [
            'group' => 'billing', 'label' => 'پایان اشتراک به دست مدیر', 'to' => 'مالک باشگاه',
            'title' => 'اشتراک باشگاه پایان یافت', 'body' => 'اشتراک باشگاه شما پایان یافت. برای تمدید از بخش «امور مالی» اقدام کنید.', 'vars' => [],
        ],

        // ---- coaching
        'workout_assigned' => [
            'group' => 'coaching', 'label' => 'برنامهٔ تمرینی جدید', 'to' => 'ورزشکار',
            'title' => 'برنامه تمرینی جدید', 'body' => 'برنامه «{title}» برای شما ثبت شد.', 'vars' => ['title' => 'نام برنامه'],
        ],
        'nutrition_assigned' => [
            'group' => 'coaching', 'label' => 'برنامهٔ غذایی جدید', 'to' => 'ورزشکار',
            'title' => 'برنامه غذایی جدید', 'body' => 'برنامه «{title}» برای شما ثبت شد.', 'vars' => ['title' => 'نام برنامه'],
        ],
        'plan_completed' => [
            'group' => 'coaching', 'label' => 'تکمیل برنامه توسط ورزشکار', 'to' => 'مربی',
            'title' => 'برنامه تکمیل شد', 'body' => '{name} برنامه «{title}» را تکمیل کرد.',
            'vars' => ['name' => 'نام ورزشکار', 'title' => 'نام برنامه'],
        ],
        'supplement_assigned' => [
            'group' => 'coaching', 'label' => 'برنامهٔ مکمل جدید', 'to' => 'ورزشکار',
            'title' => 'برنامه مکمل جدید', 'body' => 'مربی شما برنامه مکمل «{title}» را برای شما ثبت کرد.', 'vars' => ['title' => 'نام برنامه'],
        ],
        'questionnaire_assigned' => [
            'group' => 'coaching', 'label' => 'پرسشنامهٔ رایگان جدید', 'to' => 'ورزشکار',
            'title' => 'پرسشنامهٔ جدید', 'body' => 'مربی شما پرسشنامه «{title}» را برایتان فرستاد.', 'vars' => ['title' => 'نام پرسشنامه'],
        ],
        'questionnaire_invoiced' => [
            'group' => 'coaching', 'label' => 'پرسشنامهٔ پولی جدید', 'to' => 'ورزشکار',
            'title' => 'پرسشنامهٔ جدید', 'body' => 'برای پرسشنامه «{title}» فاکتوری به مبلغ {amount} تومان صادر شد.',
            'vars' => ['title' => 'نام پرسشنامه', 'amount' => 'مبلغ'],
        ],
        'questionnaire_submitted' => [
            'group' => 'coaching', 'label' => 'پاسخ به پرسشنامه', 'to' => 'مربی',
            'title' => 'پاسخ جدید', 'body' => 'یکی از ورزشکارانتان به پرسشنامه «{title}» پاسخ داد.', 'vars' => ['title' => 'نام پرسشنامه'],
        ],
        'measurement_by_athlete' => [
            'group' => 'coaching', 'label' => 'اندازه‌گیری ثبت‌شده توسط ورزشکار', 'to' => 'مربی',
            'title' => 'اندازه‌گیری جدید', 'body' => '{name} اندازه‌گیری جدیدی ثبت کرد.', 'vars' => ['name' => 'نام ورزشکار'],
        ],
        'measurement_by_trainer' => [
            'group' => 'coaching', 'label' => 'اندازه‌گیری ثبت‌شده توسط مربی', 'to' => 'ورزشکار',
            'title' => 'اندازه‌گیری جدید', 'body' => '{name} برای شما اندازه‌گیری جدیدی ثبت کرد.', 'vars' => ['name' => 'نام مربی'],
        ],
        'trainer_removed' => [
            'group' => 'coaching', 'label' => 'پایان همکاری مربی و ورزشکار', 'to' => 'ورزشکار',
            'title' => 'پایان همکاری با مربی', 'body' => 'همکاری مربی شما با شما در جیم‌لیک پایان یافت.', 'vars' => [],
        ],

        // ---- invoices
        'invoice_created' => [
            'group' => 'invoices', 'label' => 'فاکتور برنامه', 'to' => 'ورزشکار',
            'title' => 'فاکتور جدید', 'body' => 'برای برنامه «{title}» فاکتوری به مبلغ {amount} تومان صادر شد.',
            'vars' => ['title' => 'نام برنامه', 'amount' => 'مبلغ'],
        ],
        'package_invoice_created' => [
            'group' => 'invoices', 'label' => 'فاکتور پکیج جلسات', 'to' => 'ورزشکار',
            'title' => 'فاکتور جدید', 'body' => 'برای پکیج «{title}» فاکتوری به مبلغ {amount} تومان صادر شد.',
            'vars' => ['title' => 'نام پکیج', 'amount' => 'مبلغ'],
        ],
        'invoice_paid' => [
            'group' => 'invoices', 'label' => 'پرداخت فاکتور برنامه', 'to' => 'ورزشکار',
            'title' => 'پرداخت شما تایید شد', 'body' => 'پرداخت شما ثبت شد و برنامه اکنون برای شما باز است.', 'vars' => [],
        ],
        'package_invoice_paid' => [
            'group' => 'invoices', 'label' => 'پرداخت فاکتور پکیج جلسات', 'to' => 'ورزشکار',
            'title' => 'پرداخت شما تایید شد', 'body' => 'پرداخت شما ثبت شد و پکیج جلسات خصوصی شما فعال است.', 'vars' => [],
        ],
        'questionnaire_invoice_paid' => [
            'group' => 'invoices', 'label' => 'پرداخت فاکتور پرسشنامه', 'to' => 'ورزشکار',
            'title' => 'پرداخت شما تایید شد', 'body' => 'پرداخت شما ثبت شد و اکنون می‌توانید به پرسشنامه پاسخ دهید.', 'vars' => [],
        ],
        'invoice_claim_submitted' => [
            'group' => 'invoices', 'label' => 'ثبت پرداخت توسط ورزشکار', 'to' => 'مربی',
            'title' => 'پرداخت جدید برای بررسی', 'body' => '{name} پرداخت فاکتور «{title}» را ثبت کرد و منتظر تأیید شماست.',
            'vars' => ['name' => 'نام ورزشکار', 'title' => 'نام برنامه یا پکیج'],
        ],
        'invoice_claim_rejected' => [
            'group' => 'invoices', 'label' => 'رد پرداخت ثبت‌شده', 'to' => 'ورزشکار',
            'title' => 'پرداخت شما تأیید نشد', 'body' => 'مربی پرداخت ثبت‌شدهٔ شما را تأیید نکرد. {reason}',
            'vars' => ['reason' => 'دلیل مربی، یا «برای پیگیری با مربی خود صحبت کنید.»'],
        ],
        'invoice_cancelled' => [
            'group' => 'invoices', 'label' => 'لغو فاکتور', 'to' => 'ورزشکار',
            'title' => 'فاکتور لغو شد', 'body' => 'فاکتور صادرشده برای شما لغو شد و نیازی به پرداخت آن نیست.', 'vars' => [],
        ],

        // ---- reminders (sent by the cron jobs)
        'calendar_reminder' => [
            'group' => 'reminders', 'label' => 'یادآوری رویداد تقویم', 'to' => 'مربی',
            'title' => 'یادآوری: {title}', 'body' => '{details}',
            'vars' => ['title' => 'عنوان رویداد', 'details' => 'زمان و توضیح رویداد'],
        ],
        'assessment_reminder' => [
            'group' => 'reminders', 'label' => 'یادآوری اندازه‌گیری دوره‌ای', 'to' => 'ورزشکار',
            'title' => 'یادآوری ثبت اندازه‌گیری', 'body' => 'وقتشه دوباره اندازه‌هاتو ثبت کنی.', 'vars' => [],
        ],
        'athlete_birthday' => [
            'group' => 'reminders', 'label' => 'تولد ورزشکار', 'to' => 'مربی',
            'title' => 'امروز تولد {name} است', 'body' => '{name} امروز {age} ساله می‌شود. تبریک بگویید.',
            'vars' => ['name' => 'نام ورزشکار', 'age' => 'سنی که امروز به آن می‌رسد'],
        ],
        'supplement_reminder' => [
            'group' => 'reminders', 'label' => 'یادآوری مصرف مکمل', 'to' => 'ورزشکار',
            'title' => 'زمان مصرف مکمل', 'body' => '{details}', 'vars' => ['details' => 'فهرست مکمل‌ها و مقدار هرکدام'],
        ],

        // ---- messages & trainer tickets
        'message_new' => [
            'group' => 'messages', 'label' => 'پیام جدید', 'to' => 'گیرندهٔ پیام',
            'title' => 'پیام جدید', 'body' => '{name}: {text}', 'vars' => ['name' => 'نام فرستنده', 'text' => 'ابتدای پیام'],
        ],
        'ticket_new' => [
            'group' => 'messages', 'label' => 'تیکت جدید ورزشکار', 'to' => 'مربی',
            'title' => 'تیکت جدید', 'body' => '{name}: {subject}', 'vars' => ['name' => 'نام ورزشکار', 'subject' => 'موضوع تیکت'],
        ],
        'ticket_reply' => [
            'group' => 'messages', 'label' => 'پاسخ در تیکت', 'to' => 'طرف دیگر تیکت',
            'title' => 'پاسخ جدید در تیکت #{number}', 'body' => '{name}: {text}',
            'vars' => ['number' => 'شمارهٔ تیکت', 'name' => 'نام فرستنده', 'text' => 'ابتدای پاسخ'],
        ],
        'ticket_status' => [
            'group' => 'messages', 'label' => 'تغییر وضعیت تیکت', 'to' => 'ورزشکار',
            'title' => 'وضعیت تیکت #{number} تغییر کرد', 'body' => '{subject}',
            'vars' => ['number' => 'شمارهٔ تیکت', 'subject' => 'موضوع تیکت'],
        ],

        // ---- support tickets to the platform admin
        'support_new' => [
            'group' => 'support', 'label' => 'تیکت پشتیبانی جدید', 'to' => 'مدیران با دسترسی پشتیبانی',
            'title' => 'تیکت پشتیبانی #{number}', 'body' => '{name}: {subject}',
            'vars' => ['number' => 'شمارهٔ تیکت', 'name' => 'نام کاربر', 'subject' => 'موضوع'],
        ],
        'support_user_reply' => [
            'group' => 'support', 'label' => 'پاسخ کاربر در تیکت پشتیبانی', 'to' => 'مدیران با دسترسی پشتیبانی',
            'title' => 'پاسخ جدید در تیکت پشتیبانی #{number}', 'body' => '{name}: {text}',
            'vars' => ['number' => 'شمارهٔ تیکت', 'name' => 'نام کاربر', 'text' => 'ابتدای پاسخ'],
        ],
        'support_reply' => [
            'group' => 'support', 'label' => 'پاسخ پشتیبانی', 'to' => 'کاربر',
            'title' => 'پاسخ پشتیبانی به تیکت #{number}', 'body' => '{text}',
            'vars' => ['number' => 'شمارهٔ تیکت', 'subject' => 'موضوع', 'text' => 'ابتدای پاسخ'],
        ],
        'support_closed' => [
            'group' => 'support', 'label' => 'بستن تیکت پشتیبانی', 'to' => 'کاربر',
            'title' => 'تیکت #{number} بسته شد', 'body' => '{subject}',
            'vars' => ['number' => 'شمارهٔ تیکت', 'subject' => 'موضوع'],
        ],
        // ---- trainer verification
        'trainer_verification_requested' => [
            'group' => 'coaching', 'label' => 'درخواست تأیید مدارک مربی', 'to' => 'مدیران با دسترسی مدیریت کاربران',
            'title' => 'درخواست تأیید مدارک', 'body' => '{name} مدارکش را برای گرفتن نشان «مربی تأییدشده» فرستاد.',
            'vars' => ['name' => 'نام مربی'],
        ],
        'trainer_verified' => [
            'group' => 'coaching', 'label' => 'تأیید مدارک مربی', 'to' => 'مربی',
            'title' => 'مدارک شما تأیید شد', 'body' => 'از این پس نشان «مربی تأییدشده» کنار نام شما دیده می‌شود.',
            'vars' => [],
        ],
        'trainer_verification_rejected' => [
            'group' => 'coaching', 'label' => 'رد مدارک مربی', 'to' => 'مربی',
            'title' => 'مدارک شما تأیید نشد', 'body' => '{reason}',
            'vars' => ['reason' => 'توضیح مدیر'],
        ],
    ];

    private const TITLE_MAX = 255;
    private const BODY_MAX = 1000;

    private function __construct()
    {
    }

    /**
     * Sends one templated notification. Returns false when the admin
     * switched the template off (nothing is sent).
     */
    public static function notify(
        PDO $pdo,
        string $key,
        string $recipientId,
        ?string $actorId,
        string $type,
        array $vars,
        ?string $link,
        array $metadata = []
    ): bool {
        $text = self::render($key, $vars);
        if ($text === null) {
            return false;
        }
        AuthController::notify($pdo, $recipientId, $actorId, $type, $text[0], $text[1], $link, $metadata);
        return true;
    }

    /** [title, body] for $key, or null when switched off. @return array{0: string, 1: string}|null */
    public static function render(string $key, array $vars): ?array
    {
        $meta = self::CATALOG[$key] ?? null;
        if ($meta === null) {
            throw new \InvalidArgumentException("Unknown notification template: {$key}");
        }
        $stored = Settings::get('templates')[$key];
        if (!$stored['enabled']) {
            return null;
        }

        $replace = [];
        foreach ($vars as $name => $value) {
            $replace['{' . $name . '}'] = (string) $value;
        }
        $fill = static fn (string $text): string => trim(preg_replace('/[ \t]{2,}/u', ' ', strtr($text, $replace)) ?? '');

        $title = $fill($stored['title'] !== '' ? $stored['title'] : $meta['title']);
        $body = $fill($stored['body'] !== '' ? $stored['body'] : $meta['body']);

        return [mb_substr($title !== '' ? $title : $meta['title'], 0, self::TITLE_MAX), $body];
    }

    /**
     * The stored shape: every template with enabled and its overrides
     * ('' = the default). Used by Settings::normalize.
     */
    public static function normalize(array $value): array
    {
        $out = [];
        foreach (self::CATALOG as $key => $meta) {
            $entry = is_array($value[$key] ?? null) ? $value[$key] : [];
            $title = self::text($entry['title'] ?? null, self::TITLE_MAX);
            $body = self::text($entry['body'] ?? null, self::BODY_MAX);
            $out[$key] = [
                'enabled' => !array_key_exists('enabled', $entry) || !in_array($entry['enabled'], [false, 0, '0', 'false'], true),
                // Saving the default text verbatim is the same as no override.
                'title'   => $title === $meta['title'] ? '' : $title,
                'body'    => $body === $meta['body'] ? '' : $body,
            ];
        }
        return $out;
    }

    /** The catalogue for the admin screen. */
    public static function catalog(): array
    {
        $out = [];
        foreach (self::CATALOG as $key => $meta) {
            $out[] = ['key' => $key] + $meta;
        }
        return $out;
    }

    private static function text(mixed $value, int $max): string
    {
        if (!is_string($value)) {
            return '';
        }
        return mb_substr(trim($value), 0, $max);
    }
}
