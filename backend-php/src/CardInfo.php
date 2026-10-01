<?php
declare(strict_types=1);

namespace Gymlic;

/** Cleaning and checking the card number and IBAN someone types as their receiving account. */
final class CardInfo
{
    private function __construct()
    {
    }

    /** Latin digits only (Persian ones converted), everything else dropped. */
    public static function digits(mixed $value): string
    {
        $value = strtr((string) $value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    /** 16 digits that pass the Luhn check every Iranian bank card does. */
    public static function validCard(string $card): bool
    {
        if (strlen($card) !== 16) {
            return false;
        }
        $sum = 0;
        for ($i = 0; $i < 16; $i++) {
            $d = (int) $card[$i];
            if ($i % 2 === 0) {
                $d *= 2;
                if ($d > 9) {
                    $d -= 9;
                }
            }
            $sum += $d;
        }
        return $sum % 10 === 0;
    }

    /** The 24 digits of an IBAN typed with or without the leading IR. */
    public static function shebaDigits(mixed $value): string
    {
        return self::digits(preg_replace('/^\s*IR/i', '', (string) $value) ?? '');
    }
}
