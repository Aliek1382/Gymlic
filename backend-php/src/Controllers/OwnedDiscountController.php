<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\DiscountCodes;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;

/**
 * The screens where a club (owner or reception) manages the discount codes
 * for its membership plans, and a trainer the codes for their athletes'
 * invoices. Same fields and rules as the platform's codes; each person only
 * ever sees and edits their own. A code someone has already paid with is part
 * of that payment's record, so it can be switched off but not deleted.
 *
 * See DiscountCodes for the rules themselves.
 */
final class OwnedDiscountController
{
    // ---- Club ------------------------------------------------------------

    /** GET /clubs/{id}/discount-codes */
    public static function clubList(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        self::list(DiscountCodes::CLUB, DiscountCodes::clubReady(), $params['id']);
    }

    /** POST /clubs/{id}/discount-codes */
    public static function clubCreate(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        self::create(DiscountCodes::CLUB, DiscountCodes::clubReady(), $params['id'], $user['id']);
    }

    /** PATCH /clubs/{id}/discount-codes/{codeId} */
    public static function clubUpdate(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        self::update(DiscountCodes::CLUB, DiscountCodes::clubReady(), $params['id'], $params['codeId']);
    }

    /** DELETE /clubs/{id}/discount-codes/{codeId} */
    public static function clubDelete(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        self::delete(DiscountCodes::CLUB, DiscountCodes::clubReady(), $params['id'], $params['codeId']);
    }

    // ---- Trainer ---------------------------------------------------------

    /** GET /athlete-discount-codes */
    public static function trainerList(): void
    {
        $user = self::requireTrainer();
        self::list(DiscountCodes::TRAINER, DiscountCodes::trainerReady(), $user['id']);
    }

    /** POST /athlete-discount-codes */
    public static function trainerCreate(): void
    {
        $user = self::requireTrainer();
        self::create(DiscountCodes::TRAINER, DiscountCodes::trainerReady(), $user['id'], $user['id']);
    }

    /** PATCH /athlete-discount-codes/{id} */
    public static function trainerUpdate(array $params): void
    {
        $user = self::requireTrainer();
        self::update(DiscountCodes::TRAINER, DiscountCodes::trainerReady(), $user['id'], $params['id']);
    }

    /** DELETE /athlete-discount-codes/{id} */
    public static function trainerDelete(array $params): void
    {
        $user = self::requireTrainer();
        self::delete(DiscountCodes::TRAINER, DiscountCodes::trainerReady(), $user['id'], $params['id']);
    }

    // ---- The shared work -------------------------------------------------

    private static function list(array $cfg, bool $ready, string $scopeId): void
    {
        $pdo = Database::connection();
        $plans = [];
        if ($cfg['planTable'] !== null && Database::hasTable($cfg['planTable'])) {
            $stmt = $pdo->prepare(
                "SELECT id, name, price_toman, is_active FROM {$cfg['planTable']}
                 WHERE {$cfg['scopeColumn']} = :scope ORDER BY sort_order ASC, created_at ASC"
            );
            $stmt->execute(['scope' => $scopeId]);
            $plans = Cast::rows($stmt->fetchAll(), [], ['price_toman'], ['is_active']);
        }
        if (!$ready) {
            Response::ok(['ready' => false, 'items' => [], 'plans' => $plans]);
            return;
        }

        $planColumns = $cfg['planTable'] !== null ? ', d.plan_id, p.name AS plan_name' : '';
        $planJoin = $cfg['planTable'] !== null ? "LEFT JOIN {$cfg['planTable']} p ON p.id = d.plan_id" : '';
        $stmt = $pdo->prepare(
            "SELECT d.id, d.code, d.kind, d.value, d.max_uses, d.{$cfg['onceColumn']}, d.expires_at, d.is_active,
                    d.note, d.created_at{$planColumns},
                    (SELECT COUNT(*) FROM {$cfg['usesTable']} u
                      WHERE u.discount_code_id = d.id AND u.status IN ('pending', 'approved')) AS uses,
                    (SELECT COALESCE(SUM(u.discount_toman), 0) FROM {$cfg['usesTable']} u
                      WHERE u.discount_code_id = d.id AND u.status = 'approved') AS total_discount
             FROM {$cfg['table']} d {$planJoin}
             WHERE d.{$cfg['scopeColumn']} = :scope
             ORDER BY d.created_at DESC"
        );
        $stmt->execute(['scope' => $scopeId]);

        Response::ok([
            'ready' => true,
            'items' => Cast::rows($stmt->fetchAll(), [], ['value', 'max_uses', 'uses', 'total_discount'], [$cfg['onceColumn'], 'is_active']),
            'plans' => $plans,
        ]);
    }

    private static function create(array $cfg, bool $ready, string $scopeId, string $actorId): void
    {
        if (!self::requireReady($ready)) {
            return;
        }
        $pdo = Database::connection();
        $fields = self::fields($pdo, $cfg, $scopeId, Validate::body(), null);
        if ($fields === null) {
            return;
        }

        $id = Uuid::v4();
        $row = $fields + ['id' => $id, $cfg['scopeColumn'] => $scopeId];
        if ($cfg['table'] === 'club_discount_codes') {
            $row['created_by'] = $actorId;
        }
        $pdo->prepare(
            "INSERT INTO {$cfg['table']} (" . implode(', ', array_keys($row)) . ')
             VALUES (:' . implode(', :', array_keys($row)) . ')'
        )->execute($row);

        Response::ok(['id' => $id], 201);
    }

    private static function update(array $cfg, bool $ready, string $scopeId, string $codeId): void
    {
        if (!self::requireReady($ready)) {
            return;
        }
        $pdo = Database::connection();
        if (!self::owns($pdo, $cfg, $scopeId, $codeId)) {
            Response::error(404, 'not_found', 'کد تخفیف پیدا نشد.');
            return;
        }

        $fields = self::fields($pdo, $cfg, $scopeId, Validate::body(), $codeId);
        if ($fields === null) {
            return;
        }
        $set = implode(', ', array_map(static fn (string $k): string => "{$k} = :{$k}", array_keys($fields)));
        $pdo->prepare("UPDATE {$cfg['table']} SET {$set} WHERE id = :id")->execute($fields + ['id' => $codeId]);

        Response::ok(['ok' => true]);
    }

    private static function delete(array $cfg, bool $ready, string $scopeId, string $codeId): void
    {
        if (!self::requireReady($ready)) {
            return;
        }
        $pdo = Database::connection();
        if (!self::owns($pdo, $cfg, $scopeId, $codeId)) {
            Response::error(404, 'not_found', 'کد تخفیف پیدا نشد.');
            return;
        }

        $used = $pdo->prepare("SELECT 1 FROM {$cfg['usesTable']} WHERE discount_code_id = :id LIMIT 1");
        $used->execute(['id' => $codeId]);
        if ($used->fetch() !== false) {
            Response::error(409, 'code_in_use', 'این کد در پرداخت‌ها استفاده شده و سابقه‌اش باید بماند؛ به‌جای حذف، غیرفعالش کنید.');
            return;
        }

        $pdo->prepare("DELETE FROM {$cfg['table']} WHERE id = :id")->execute(['id' => $codeId]);
        Response::ok(['ok' => true]);
    }

    private static function owns(PDO $pdo, array $cfg, string $scopeId, string $codeId): bool
    {
        $stmt = $pdo->prepare("SELECT 1 FROM {$cfg['table']} WHERE id = :id AND {$cfg['scopeColumn']} = :scope");
        $stmt->execute(['id' => $codeId, 'scope' => $scopeId]);

        return $stmt->fetch() !== false;
    }

    /**
     * The validated columns of a code, or null after answering 400/404/409.
     *
     * @return array<string, mixed>|null
     */
    private static function fields(PDO $pdo, array $cfg, string $scopeId, array $data, ?string $id): ?array
    {
        $parsed = DiscountCodes::parseFields($data, $cfg['onceColumn']);
        if (!$parsed['ok']) {
            Response::error($parsed['status'], $parsed['error'], $parsed['message']);
            return null;
        }
        $fields = $parsed['fields'];

        // A code is unique within whoever made it, not across the site.
        $taken = $pdo->prepare(
            "SELECT 1 FROM {$cfg['table']} WHERE {$cfg['scopeColumn']} = :scope AND code = :code AND id <> :id"
        );
        $taken->execute(['scope' => $scopeId, 'code' => $fields['code'], 'id' => $id ?? '']);
        if ($taken->fetch() !== false) {
            Response::error(409, 'code_taken', 'کد تخفیفی با همین متن دارید.');
            return null;
        }

        if ($cfg['planTable'] !== null) {
            $planId = Validate::nullableString(isset($data['plan_id']) ? (string) $data['plan_id'] : null);
            if ($planId !== null) {
                $plan = $pdo->prepare("SELECT 1 FROM {$cfg['planTable']} WHERE id = :id AND {$cfg['scopeColumn']} = :scope");
                $plan->execute(['id' => $planId, 'scope' => $scopeId]);
                if ($plan->fetch() === false) {
                    Response::error(404, 'plan_not_found', 'طرح انتخاب‌شده پیدا نشد.');
                    return null;
                }
            }
            $fields['plan_id'] = $planId;
        }

        return $fields;
    }

    private static function requireReady(bool $ready): bool
    {
        if ($ready) {
            return true;
        }
        Response::error(409, 'discounts_unavailable', 'به‌روزرسانی دیتابیس برای کد تخفیف هنوز اجرا نشده است.');
        return false;
    }

    private static function requireTrainer(): array
    {
        $user = Auth::requireUser();
        if ($user['account_type'] !== 'trainer') {
            Response::error(403, 'forbidden', 'این بخش مخصوص مربی‌هاست.');
            exit;
        }
        return $user;
    }
}
