<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Receipts;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\Templates;

/**
 * A trainer's bill to one athlete for one plan (workout_assignments /
 * nutrition_assignments), one session package (session_packages) or one
 * questionnaire sent to them (questionnaire_responses). item_id is
 * polymorphic across those tables, so there is no FK on it — ownership is
 * checked here instead. A pending invoice locks a plan's or questionnaire's
 * content for the athlete (see PlanController, QuestionnaireController);
 * settling a session_package invoice activates the package (see
 * SessionPackageController::activate).
 *
 * Not to be confused with payment_requests (an athlete paying their club),
 * revenue_entries (the club's manual ledger) or plans (Gymlic's own pricing).
 */
final class InvoiceController
{
    private const ITEM_KIND = ['workout_plan' => 'workout', 'nutrition_plan' => 'nutrition'];
    private const MANUAL_METHODS = ['cash', 'card_transfer'];

    /** Invoice row -> what the API returns (BIGINT cast, short display number). */
    private const SELECT = 'i.id, i.trainer_id, i.athlete_id, i.item_type, i.item_id, i.amount_toman,
                            i.status, i.payment_method, i.note, i.paid_at, i.created_at';

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['item_type', 'item_id', 'amount_toman']);

        $itemType = (string) $data['item_type'];
        if (!isset(self::ITEM_KIND[$itemType])) {
            Response::error(400, 'invalid_item_type', 'item_type must be workout_plan or nutrition_plan.');
            return;
        }

        $amount = filter_var($data['amount_toman'], FILTER_VALIDATE_INT);
        if ($amount === false || $amount <= 0) {
            Response::error(400, 'invalid_amount', 'amount_toman must be a positive whole number.');
            return;
        }

        $itemId = (string) $data['item_id'];
        $table = Acl::planTable(self::ITEM_KIND[$itemType]);
        $pdo = Database::connection();

        $stmt = $pdo->prepare("SELECT id, trainer_id, athlete_id, title, is_template FROM {$table} WHERE id = :id");
        $stmt->execute(['id' => $itemId]);
        $plan = $stmt->fetch();

        if ($plan === false) {
            Response::error(404, 'not_found', 'Plan not found.');
            return;
        }
        Acl::require($plan['trainer_id'] === $user['id'], 'Only the plan\'s trainer can price it.');

        if ((int) $plan['is_template'] === 1 || $plan['athlete_id'] === null) {
            Response::error(400, 'not_assigned', 'Only a plan assigned to an athlete can be priced.');
            return;
        }

        $existing = self::findByItem($itemType, $itemId);
        if ($existing !== null && $existing['status'] !== 'cancelled') {
            Response::error(409, 'invoice_exists', $existing['status'] === 'paid'
                ? 'This plan is already paid.'
                : 'This plan already has a pending invoice. Cancel it first to change the price.');
            return;
        }

        if ($existing !== null) {
            // UNIQUE(item_type, item_id) allows one row per plan, so re-issuing
            // after a cancel revives that row with the new price.
            $id = $existing['id'];
            $pdo->prepare(
                "UPDATE invoices
                 SET amount_toman = :amount, status = 'pending', payment_method = NULL, note = NULL, paid_at = NULL,
                     created_at = CURRENT_TIMESTAMP
                 WHERE id = :id AND status = 'cancelled'"
            )->execute(['amount' => $amount, 'id' => $id]);
        } else {
            try {
                $id = self::issue($user['id'], $plan['athlete_id'], $itemType, $itemId, $amount);
            } catch (\PDOException $e) {
                // Two clicks racing past the check above.
                if ($e->getCode() === '23000') {
                    Response::error(409, 'invoice_exists', 'This plan already has an invoice.');
                    return;
                }
                throw $e;
            }
        }

        Templates::notify(
            $pdo,
            'invoice_created',
            $plan['athlete_id'],
            $user['id'],
            'invoice_created',
            ['title' => $plan['title'], 'amount' => number_format($amount)],
            self::linkFor($itemType),
            ['invoice_id' => $id]
        );

        Response::ok(['id' => $id], 201);
    }

    /** A trainer's invoices — for one athlete, or (no athlete_id) across the whole roster. */
    public static function list(): void
    {
        $user = Auth::requireUser();
        $athleteId = Validate::nullableString($_GET['athlete_id'] ?? null);

        $sql = self::listSql() . ' WHERE i.trainer_id = :trainer_id';
        $bind = ['trainer_id' => $user['id']];
        if ($athleteId !== null) {
            $sql .= ' AND i.athlete_id = :athlete_id';
            $bind['athlete_id'] = $athleteId;
        }

        $stmt = Database::connection()->prepare($sql . ' ORDER BY i.created_at DESC');
        $stmt->execute($bind);

        Response::ok(['items' => self::withClaims(self::present($stmt->fetchAll()), true)]);
    }

    public static function listMine(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            self::listSql() . " WHERE i.athlete_id = :athlete_id AND i.status <> 'cancelled' ORDER BY i.created_at DESC"
        );
        $stmt->execute(['athlete_id' => $user['id']]);

        Response::ok([
            'items'          => self::withPayTo(self::withClaims(self::present($stmt->fetchAll()), false)),
            // Whether an athlete can say "I paid" (the claims database update has run).
            'claims_enabled' => Receipts::claimsReady(),
        ]);
    }

    public static function markPaid(array $params): void
    {
        $user = Auth::requireUser();
        $invoice = self::invoiceOr404($params['id']);
        Acl::require($invoice['trainer_id'] === $user['id'], 'Only the invoicing trainer can settle it.');

        $data = Validate::body();
        $method = (string) ($data['payment_method'] ?? '');
        if (!in_array($method, self::MANUAL_METHODS, true)) {
            Response::error(400, 'invalid_payment_method', 'payment_method must be cash or card_transfer.');
            return;
        }

        $note = Validate::nullableString(isset($data['note']) ? (string) $data['note'] : null);
        if (!self::settle($invoice, $method, $note, $user['id'])) {
            Response::error(409, 'not_pending', 'Only a pending invoice can be marked paid.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    /**
     * Marks a pending invoice paid and everything that follows from it: a
     * session package is activated, a claim the athlete filed is closed as
     * approved, and the athlete is told. False when the invoice was not
     * pending (someone else settled or cancelled it first).
     */
    public static function settle(array $invoice, string $method, ?string $note, string $actorId): bool
    {
        $pdo = Database::connection();
        // Settling and activating a session package are one step: a paid
        // invoice with no sessions behind it would leave the athlete stuck.
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "UPDATE invoices SET status = 'paid', payment_method = :method, note = :note, paid_at = NOW()
                 WHERE id = :id AND status = 'pending'"
            );
            $stmt->execute(['method' => $method, 'note' => $note, 'id' => $invoice['id']]);

            if ($stmt->rowCount() === 0) {
                $pdo->rollBack();
                return false;
            }

            if ($invoice['item_type'] === 'session_package') {
                SessionPackageController::activate($invoice['item_id']);
            }
            if (Receipts::claimsReady()) {
                $pdo->prepare(
                    "UPDATE invoice_payment_claims SET status = 'approved', reviewed_at = NOW()
                     WHERE invoice_id = :id AND status = 'pending'"
                )->execute(['id' => $invoice['id']]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Templates::notify(
            $pdo,
            match ($invoice['item_type']) {
                'session_package' => 'package_invoice_paid',
                'questionnaire'   => 'questionnaire_invoice_paid',
                default           => 'invoice_paid',
            },
            $invoice['athlete_id'],
            $actorId,
            'invoice_paid',
            [],
            self::linkFor($invoice['item_type']),
            ['invoice_id' => $invoice['id']]
        );

        return true;
    }

    public static function cancel(array $params): void
    {
        $user = Auth::requireUser();
        $invoice = self::invoiceOr404($params['id']);
        Acl::require($invoice['trainer_id'] === $user['id'], 'Only the invoicing trainer can cancel it.');

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE invoices SET status = 'cancelled' WHERE id = :id AND status = 'pending'");
            $stmt->execute(['id' => $invoice['id']]);

            if ($stmt->rowCount() === 0) {
                $pdo->rollBack();
                Response::error(409, 'not_pending', 'Only a pending invoice can be cancelled.');
                return;
            }

            // An unpaid package has nothing left to wait for once its bill is void.
            if ($invoice['item_type'] === 'session_package') {
                SessionPackageController::cancelUnpaid($invoice['item_id']);
            }
            if (Receipts::claimsReady()) {
                $pdo->prepare(
                    "UPDATE invoice_payment_claims
                     SET status = 'rejected', trainer_note = 'فاکتور لغو شد.', reviewed_at = NOW()
                     WHERE invoice_id = :id AND status = 'pending'"
                )->execute(['id' => $invoice['id']]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Templates::notify(
            $pdo,
            'invoice_cancelled',
            $invoice['athlete_id'],
            $user['id'],
            'invoice_cancelled',
            [],
            self::linkFor($invoice['item_type']),
            ['invoice_id' => $invoice['id']]
        );

        Response::ok(['ok' => true]);
    }

    /**
     * Inserts a pending invoice and returns its id. Callers own the checks
     * (who may bill whom, for what) — this only writes the row, so anything
     * that sells something billable can issue an invoice without copying the
     * INSERT. Throws PDOException (SQLSTATE 23000) if the item already has one.
     */
    public static function issue(string $trainerId, string $athleteId, string $itemType, string $itemId, int $amount): string
    {
        $id = Uuid::v4();
        Database::connection()->prepare(
            "INSERT INTO invoices (id, trainer_id, athlete_id, item_type, item_id, amount_toman)
             VALUES (:id, :trainer_id, :athlete_id, :item_type, :item_id, :amount)"
        )->execute([
            'id'         => $id,
            'trainer_id' => $trainerId,
            'athlete_id' => $athleteId,
            'item_type'  => $itemType,
            'item_id'    => $itemId,
            'amount'     => $amount,
        ]);

        return $id;
    }

    /** Whether a pending invoice currently locks this plan for its athlete. */
    public static function isLocked(string $itemType, string $itemId): bool
    {
        return self::pendingByItem($itemType, [$itemId]) !== [];
    }

    /**
     * Pending invoices for a batch of plans, keyed by item_id, in the small
     * shape a locked plan carries. One query however many plans, and no rows
     * at all for a plan without an invoice — the common case.
     *
     * @param string[] $itemIds
     * @return array<string, array{id: string, number: string, amount_toman: int}>
     */
    public static function pendingByItem(string $itemType, array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        $itemIds = array_values($itemIds);
        $marks = implode(',', array_fill(0, count($itemIds), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT id, item_id, amount_toman FROM invoices
             WHERE item_type = ? AND status = 'pending' AND item_id IN ({$marks})"
        );
        $stmt->execute([$itemType, ...$itemIds]);

        $locked = [];
        foreach ($stmt->fetchAll() as $row) {
            $locked[$row['item_id']] = [
                'id'           => $row['id'],
                'number'       => self::number($row['id']),
                'amount_toman' => (int) $row['amount_toman'],
            ];
        }
        return $locked;
    }

    /** invoices.item_type for a plan {kind} path segment. */
    public static function itemTypeFor(string $kind): string
    {
        return $kind === 'nutrition' ? 'nutrition_plan' : 'workout_plan';
    }

    private static function number(string $id): string
    {
        return strtoupper(substr($id, 0, 8));
    }

    public static function linkFor(string $itemType): string
    {
        return match ($itemType) {
            'nutrition_plan'  => '/nutrition',
            'session_package' => '/session-packages',
            'questionnaire'   => '/questionnaires',
            default           => '/workout',
        };
    }

    private static function listSql(): string
    {
        return 'SELECT ' . self::SELECT . ",
                       COALESCE(wa.title, na.title, sp.title, qn.title) AS item_title,
                       ap.first_name AS athlete_first_name, ap.last_name AS athlete_last_name
                FROM invoices i
                JOIN profiles ap ON ap.id = i.athlete_id
                LEFT JOIN workout_assignments wa ON i.item_type = 'workout_plan' AND wa.id = i.item_id
                LEFT JOIN nutrition_assignments na ON i.item_type = 'nutrition_plan' AND na.id = i.item_id
                LEFT JOIN session_packages sp ON i.item_type = 'session_package' AND sp.id = i.item_id
                LEFT JOIN questionnaire_responses qr ON i.item_type = 'questionnaire' AND qr.id = i.item_id
                LEFT JOIN questionnaires qn ON qn.id = qr.questionnaire_id";
    }

    private static function present(array $rows): array
    {
        $rows = Cast::rows($rows, [], ['amount_toman']);
        foreach ($rows as &$row) {
            $row['number'] = self::number($row['id']);
        }
        return $rows;
    }

    /** The plan, package or questionnaire title an invoice is for. */
    public static function titleOf(string $invoiceId): string
    {
        $stmt = Database::connection()->prepare(self::listSql() . ' WHERE i.id = :id');
        $stmt->execute(['id' => $invoiceId]);
        $row = $stmt->fetch();

        return $row === false ? '' : (string) ($row['item_title'] ?? '');
    }

    /**
     * Gives each invoice its latest "I paid" claim (or null). The trainer's
     * view also learns whether another claim to them used the same tracking
     * code; the athlete's does not.
     */
    private static function withClaims(array $rows, bool $forTrainer): array
    {
        if (!Receipts::claimsReady() || $rows === []) {
            foreach ($rows as &$row) {
                $row['claim'] = null;
            }
            return $rows;
        }

        $ids = array_column($rows, 'id');
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $duplicate = $forTrainer
            ? ', EXISTS (SELECT 1 FROM invoice_payment_claims o
                         JOIN invoices oi ON oi.id = o.invoice_id
                         JOIN invoices ci ON ci.id = c.invoice_id
                         WHERE o.tracking_code = c.tracking_code AND o.invoice_id <> c.invoice_id
                           AND oi.trainer_id = ci.trainer_id) AS duplicate_tracking'
            : ', 0 AS duplicate_tracking';
        $stmt = Database::connection()->prepare(
            "SELECT c.id, c.invoice_id, c.status, c.tracking_code, c.card_last4, c.paid_at, c.note,
                    c.trainer_note, c.reviewed_at, c.created_at, c.receipt_purged_at,
                    (c.receipt_path IS NOT NULL) AS has_receipt,
                    (c.receipt_path LIKE '%.pdf') AS receipt_is_pdf{$duplicate}
             FROM invoice_payment_claims c
             WHERE c.invoice_id IN ({$marks}) ORDER BY c.created_at DESC"
        );
        $stmt->execute($ids);

        $latest = [];
        foreach ($stmt->fetchAll() as $claim) {
            // Newest first, so the first one seen for an invoice is its latest.
            $latest[$claim['invoice_id']] ??= Cast::row($claim, [], [], ['has_receipt', 'receipt_is_pdf', 'duplicate_tracking']);
        }
        foreach ($rows as &$row) {
            $row['claim'] = $latest[$row['id']] ?? null;
        }

        return $rows;
    }

    /** Where an athlete sends the money for each still-pending invoice: the trainer's card details. */
    private static function withPayTo(array $rows): array
    {
        $trainerIds = array_values(array_unique(array_column(
            array_filter($rows, static fn (array $r): bool => $r['status'] === 'pending'),
            'trainer_id'
        )));
        $info = [];
        if ($trainerIds !== [] && Database::hasTable('trainer_payment_info')) {
            $marks = implode(',', array_fill(0, count($trainerIds), '?'));
            $stmt = Database::connection()->prepare(
                "SELECT p.id, p.first_name, p.last_name, t.card_number, t.sheba, t.holder_name, t.bank_name
                 FROM profiles p LEFT JOIN trainer_payment_info t ON t.trainer_id = p.id
                 WHERE p.id IN ({$marks})"
            );
            $stmt->execute($trainerIds);
            foreach ($stmt->fetchAll() as $t) {
                $info[$t['id']] = [
                    'trainer_name' => trim($t['first_name'] . ' ' . $t['last_name']),
                    'card_number'  => $t['card_number'] ?? '',
                    'sheba'        => $t['sheba'] ?? '',
                    'holder_name'  => $t['holder_name'] ?? '',
                    'bank_name'    => $t['bank_name'] ?? '',
                ];
            }
        }
        foreach ($rows as &$row) {
            $row['pay_to'] = $row['status'] === 'pending' ? ($info[$row['trainer_id']] ?? null) : null;
        }

        return $rows;
    }

    private static function findByItem(string $itemType, string $itemId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, status FROM invoices WHERE item_type = :item_type AND item_id = :item_id'
        );
        $stmt->execute(['item_type' => $itemType, 'item_id' => $itemId]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    private static function invoiceOr404(string $id): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, trainer_id, athlete_id, item_type, item_id, status FROM invoices WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $invoice = $stmt->fetch();

        if ($invoice === false) {
            Response::error(404, 'not_found', 'Invoice not found.');
            exit;
        }

        return $invoice;
    }
}
