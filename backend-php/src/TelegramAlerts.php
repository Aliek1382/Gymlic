<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * The messages the owner's Telegram bot sends, one method per kind of event.
 * They only ever carry a copy of something already saved in the panel, so a
 * failure is logged and swallowed: nothing here may break the request that
 * called it, and nothing here throws.
 *
 * Each call is a no-op until the bot is configured (TelegramGateway).
 */
final class TelegramAlerts
{
    private const SITE = 'https://gymlic-panel.ir';

    private function __construct()
    {
    }

    /**
     * A card-to-card payment waiting for a finance admin.
     *
     * @param array{
     *   kind: 'club'|'trainer', who: string, owner?: string, plan: string, amount: int,
     *   paid_amount?: int|null, discount?: int, discount_code?: string, tracking_code?: string|null,
     *   card_last4?: string|null, paid_at?: string|null, note?: string|null, receipt?: string|null
     * } $p  `receipt` is the stored file name (see Receipts), not a path.
     */
    public static function paymentSubmitted(array $p): void
    {
        try {
            if (!TelegramGateway::configured()) {
                return;
            }

            $club = $p['kind'] === 'club';
            $lines = [
                '💰 <b>' . ($club ? 'پرداخت جدید اشتراک باشگاه' : 'پرداخت جدید اشتراک مربی') . '</b>',
                '',
                ($club ? 'باشگاه' : 'مربی') . ': ' . TelegramGateway::esc($p['who'])
                    . (($p['owner'] ?? '') !== '' && $p['owner'] !== $p['who'] ? ' (' . TelegramGateway::esc($p['owner']) . ')' : ''),
                'پلن: ' . TelegramGateway::esc($p['plan']),
                'مبلغ: ' . self::toman($p['amount']),
            ];

            if (($p['paid_amount'] ?? null) !== null && (int) $p['paid_amount'] !== $p['amount']) {
                $lines[] = '⚠️ مبلغ واریزی اعلام‌شده: ' . self::toman((int) $p['paid_amount']);
            }
            if ((int) ($p['discount'] ?? 0) > 0) {
                $lines[] = 'تخفیف: ' . self::toman((int) $p['discount'])
                    . (($p['discount_code'] ?? '') !== '' ? ' (کد <code>' . TelegramGateway::esc($p['discount_code']) . '</code>)' : '');
            }

            $tracking = (string) ($p['tracking_code'] ?? '');
            if ($tracking !== '' && $tracking !== 'DISCOUNT') {
                $lines[] = 'کد رهگیری: <code>' . TelegramGateway::esc($tracking) . '</code>';
            }
            if (($p['card_last4'] ?? '') !== '' && $p['card_last4'] !== '0000') {
                $lines[] = '۴ رقم آخر کارت: <code>' . TelegramGateway::esc($p['card_last4']) . '</code>';
            }
            $paidAt = Jalali::format($p['paid_at'] ?? null, true);
            if ($paidAt !== '') {
                $lines[] = 'تاریخ واریز: ' . $paidAt;
            }
            if (($p['note'] ?? '') !== '') {
                $lines[] = 'توضیح: ' . TelegramGateway::esc(mb_substr((string) $p['note'], 0, 300));
            }

            $path = Receipts::path($p['receipt'] ?? null);
            $hasReceipt = $path !== null && is_file($path);
            if ($tracking === 'DISCOUNT') {
                $lines[] = 'پرداخت ندارد: کد تخفیف کل مبلغ را پوشش داده است.';
            } else {
                $lines[] = 'رسید: ' . ($hasReceipt ? 'در پیام بعدی' : 'پیوست نشده');
            }

            $lines[] = '';
            $lines[] = '<a href="' . self::SITE . ($club ? '/admin/payments' : '/admin/trainer-billing') . '">باز کردن در پنل</a>';

            // The text first: if Telegram is unreachable this fails fast and
            // the receipt is not tried, so a request waits for one timeout.
            if (!TelegramGateway::send(implode("\n", $lines))) {
                error_log('telegram payment alert: ' . TelegramGateway::lastError());
                return;
            }
            if ($hasReceipt && !TelegramGateway::sendFile($path, '🧾 رسید ' . TelegramGateway::esc($p['who']))) {
                error_log('telegram payment receipt: ' . TelegramGateway::lastError());
            }
        } catch (\Throwable $e) {
            error_log('telegram payment alert: ' . $e->getMessage());
        }
    }

    private const CATEGORIES = [
        'bug' => 'مشکل فنی', 'billing' => 'مالی و اشتراک', 'account' => 'حساب کاربری',
        'suggestion' => 'پیشنهاد', 'other' => 'سایر',
    ];
    private const ROLES = ['club' => 'صاحب باشگاه', 'trainer' => 'مربی', 'athlete' => 'ورزشکار'];

    /**
     * A support ticket event from a user: 'new' (a ticket was opened), 'reply'
     * (the user wrote again, which reopens it) or 'closed' (the user closed it).
     * The admin's own replies are not announced: they wrote them.
     *
     * @param array<string, mixed> $user    the signed-in user's profile row
     * @param array{id: string, number: int|string, category?: string, subject: string} $ticket
     */
    public static function support(string $event, array $user, array $ticket, string $text = ''): void
    {
        try {
            if (!TelegramGateway::configured()) {
                return;
            }

            $title = ['new' => '🎫 <b>تیکت پشتیبانی جدید</b>', 'reply' => '💬 <b>پاسخ جدید کاربر در تیکت</b>', 'closed' => '✅ <b>تیکت توسط کاربر بسته شد</b>'][$event] ?? null;
            if ($title === null) {
                return;
            }

            $name = trim(((string) ($user['first_name'] ?? '')) . ' ' . ((string) ($user['last_name'] ?? '')));
            $name = $name !== '' ? $name : (string) ($user['email'] ?? '');
            $role = self::ROLES[(string) ($user['account_type'] ?? '')] ?? '';

            $lines = [$title, '', 'شمارهٔ تیکت: ' . strtr((string) $ticket['number'], ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹'])];
            $lines[] = 'از: ' . TelegramGateway::esc($name) . ($role !== '' ? ' (' . $role . ')' : '');
            if (($user['phone'] ?? '') !== '') {
                $lines[] = 'تلفن: <code>' . TelegramGateway::esc((string) $user['phone']) . '</code>';
            }
            if (($ticket['category'] ?? '') !== '') {
                $lines[] = 'دسته: ' . (self::CATEGORIES[$ticket['category']] ?? TelegramGateway::esc($ticket['category']));
            }
            $lines[] = 'موضوع: ' . TelegramGateway::esc($ticket['subject']);
            if ($text !== '') {
                $lines[] = '';
                $lines[] = TelegramGateway::esc(mb_strlen($text) > 500 ? mb_substr($text, 0, 500) . '…' : $text);
            }
            $lines[] = '';
            $lines[] = '<a href="' . self::SITE . '/admin/support?id=' . rawurlencode($ticket['id']) . '">باز کردن در پنل</a>';

            if (!TelegramGateway::send(implode("\n", $lines))) {
                error_log('telegram support alert: ' . TelegramGateway::lastError());
            }
        } catch (\Throwable $e) {
            error_log('telegram support alert: ' . $e->getMessage());
        }
    }

    private static function toman(int $amount): string
    {
        return strtr(number_format($amount), ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹'])
            . ' تومان';
    }
}
