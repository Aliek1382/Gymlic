<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Limits;
use Gymlic\Discounts;
use Gymlic\Receipts;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\TrainerBilling;
use Gymlic\Validate;

/** What a club owner sees while paying for their subscription. */
final class BillingController
{
    /** Where to transfer the money, as the admin set it in the finance pages. */
    public static function info(): void
    {
        Auth::requireUser();
        $billing = Settings::get('billing');

        Response::ok([
            'payment' => [
                'card_number'    => $billing['card_number'],
                'sheba'          => $billing['sheba'],
                'account_holder' => $billing['account_holder'],
                'bank_name'      => $billing['bank_name'],
                'instructions'   => $billing['instructions'],
            ],
            'discounts_enabled' => Discounts::ready(),
            // What the payment dialog asks for besides the amount; absent
            // until the receipts database update has run.
            'receipts' => (Receipts::ready() || Receipts::claimsReady() || TrainerBilling::ready() || Database::hasTable('membership_payment_requests')) ? [
                'required'       => $billing['receipt_required'],
                'max_mb'         => $billing['receipt_max_mb'],
                'retention_days' => $billing['receipt_retention_days'],
            ] : null,
        ]);
    }

    /** The price a code gives for a plan, before the club files its request. */
    public static function checkDiscount(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['code', 'plan_id']);
        $pdo = Database::connection();

        $club = $pdo->prepare('SELECT id FROM clubs WHERE owner_id = :owner_id');
        $club->execute(['owner_id' => $user['id']]);
        $clubId = $club->fetchColumn();
        if ($clubId === false) {
            Response::error(403, 'forbidden', 'Only a club owner can use a discount code.');
            return;
        }
        if (!Discounts::ready()) {
            Response::error(409, 'discounts_unavailable', 'کد تخفیف فعلاً پذیرفته نمی‌شود.');
            return;
        }

        $plan = $pdo->prepare('SELECT id, name, price_toman FROM plans WHERE id = :id AND is_active = 1' . Limits::notFreeClubPlan());
        $plan->execute(['id' => (string) $data['plan_id']]);
        $plan = $plan->fetch();
        if ($plan === false) {
            Response::error(404, 'plan_not_found', 'That plan is not available.');
            return;
        }

        $result = Discounts::evaluate($pdo, (string) $data['code'], $plan, (string) $clubId);
        if (!$result['ok']) {
            Response::error(409, $result['error'], $result['message']);
            return;
        }

        Response::ok([
            'code'             => $result['code']['code'],
            'list_price_toman' => $result['list_price'],
            'discount_toman'   => $result['discount'],
            'final_toman'      => $result['final'],
        ]);
    }
}
