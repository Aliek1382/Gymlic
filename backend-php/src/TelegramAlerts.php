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

    private static function toman(int $amount): string
    {
        return strtr(number_format($amount), ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹'])
            . ' تومان';
    }
}
