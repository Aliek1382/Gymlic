<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\Templates;

/**
 * A block of N private sessions a trainer sells one athlete. Selling it issues
 * an invoice (InvoiceController); settling that invoice calls activate(), which
 * creates the N empty package_sessions rows the trainer then schedules, holds
 * or cancels one by one.
 *
 * Not to be confused with class_attendance_logs (a club's class attendance) or
 * the `sessions` table (login tokens — hence package_sessions).
 */
final class SessionPackageController
{
    private const MAX_SESSIONS = 100;
    private const OPEN_STATUSES = ['unscheduled', 'scheduled'];

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(
            Validate::body(),
            ['athlete_id', 'title', 'total_sessions', 'price_toman']
        );

        $athleteId = (string) $data['athlete_id'];
        Acl::require(Acl::isTrainerOf($user['id'], $athleteId), 'This athlete is not on your roster.');

        $title = trim((string) $data['title']);
        if ($title === '' || mb_strlen($title) > 255) {
            Response::error(400, 'invalid_title', 'title must be 1 to 255 characters.');
            return;
        }

        $total = filter_var($data['total_sessions'], FILTER_VALIDATE_INT);
        if ($total === false || $total < 1 || $total > self::MAX_SESSIONS) {
            Response::error(400, 'invalid_total_sessions', 'total_sessions must be a whole number from 1 to ' . self::MAX_SESSIONS . '.');
            return;
        }

        $price = filter_var($data['price_toman'], FILTER_VALIDATE_INT);
        $discount = filter_var($data['discount_toman'] ?? 0, FILTER_VALIDATE_INT);
        if ($price === false || $discount === false || $price < 0 || $discount < 0) {
            Response::error(400, 'invalid_amount', 'price_toman and discount_toman must be whole numbers, zero or more.');
            return;
        }

        // The invoice has to be for a positive amount, so a package can't be free.
        $amount = $price - $discount;
        if ($amount <= 0) {
            Response::error(400, 'invalid_amount', 'The discount must be less than the price.');
            return;
        }

        $pdo = Database::connection();
        $id = Uuid::v4();

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO session_packages (id, trainer_id, athlete_id, title, total_sessions, price_toman, discount_toman)
                 VALUES (:id, :trainer_id, :athlete_id, :title, :total, :price, :discount)"
            )->execute([
                'id'         => $id,
                'trainer_id' => $user['id'],
                'athlete_id' => $athleteId,
                'title'      => $title,
                'total'      => $total,
                'price'      => $price,
                'discount'   => $discount,
            ]);

            $invoiceId = InvoiceController::issue($user['id'], $athleteId, 'session_package', $id, $amount);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Templates::notify(
            $pdo,
            'package_invoice_created',
            $athleteId,
            $user['id'],
            'invoice_created',
            ['title' => $title, 'amount' => number_format($amount)],
            '/session-packages',
            ['invoice_id' => $invoiceId, 'package_id' => $id]
        );

        Response::ok(['id' => $id, 'invoice_id' => $invoiceId], 201);
    }

    /** A trainer's packages for one athlete. */
    public static function list(): void
    {
        $user = Auth::requireUser();
        $athleteId = Validate::nullableString($_GET['athlete_id'] ?? null);
        if ($athleteId === null) {
            Response::error(400, 'missing_fields', 'Missing required field(s): athlete_id');
            return;
        }

        $stmt = Database::connection()->prepare(
            self::listSql() . ' WHERE sp.trainer_id = :trainer_id AND sp.athlete_id = :athlete_id
                                ORDER BY sp.created_at DESC'
        );
        $stmt->execute(['trainer_id' => $user['id'], 'athlete_id' => $athleteId]);

        Response::ok(['items' => self::present($stmt->fetchAll())]);
    }

    /**
     * The athlete's own packages. An unpaid one is listed so the amount is
     * visible, but its sessions aren't (see listSessions) — and a cancelled
     * one is gone from their side entirely, like a cancelled invoice.
     */
    public static function listMine(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            self::listSql() . " WHERE sp.athlete_id = :athlete_id AND sp.status <> 'cancelled'
                                ORDER BY sp.created_at DESC"
        );
        $stmt->execute(['athlete_id' => $user['id']]);

        Response::ok(['items' => self::present($stmt->fetchAll())]);
    }

    public static function listSessions(array $params): void
    {
        $user = Auth::requireUser();
        $package = self::packageOr404($params['id']);

        $isTrainer = $package['trainer_id'] === $user['id'];
        Acl::require($isTrainer || $package['athlete_id'] === $user['id']);

        if ($package['status'] === 'pending_payment' || ($package['status'] === 'cancelled' && !$isTrainer)) {
            Response::ok(['items' => []]);
            return;
        }

        // Dated sessions first in date order, the not-yet-planned ones after.
        $stmt = Database::connection()->prepare(
            'SELECT id, package_id, scheduled_at, status, note, created_at
             FROM package_sessions
             WHERE package_id = :package_id
             ORDER BY scheduled_at IS NULL, scheduled_at, created_at, id'
        );
        $stmt->execute(['package_id' => $package['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    /**
     * Plan, hold or cancel one session. done/canceled are final, and once every
     * session of a package has reached one of them the package completes.
     */
    public static function updateSession(array $params): void
    {
        $user = Auth::requireUser();
        $package = self::packageOr404($params['id']);
        Acl::require($package['trainer_id'] === $user['id'], 'Only the package\'s trainer can update its sessions.');

        $data = Validate::body();
        $hasDate = array_key_exists('scheduled_at', $data);
        $hasStatus = array_key_exists('status', $data);
        if (!$hasDate && !$hasStatus) {
            Response::error(400, 'missing_fields', 'Pass scheduled_at and/or status.');
            return;
        }

        if ($package['status'] !== 'active') {
            Response::error(409, 'package_not_active', 'Only the sessions of an active package can be changed.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT id, status, scheduled_at FROM package_sessions WHERE id = :id AND package_id = :package_id');
        $stmt->execute(['id' => $params['sessionId'], 'package_id' => $package['id']]);
        $session = $stmt->fetch();
        if ($session === false) {
            Response::error(404, 'not_found', 'Session not found.');
            return;
        }
        if (!in_array($session['status'], self::OPEN_STATUSES, true)) {
            Response::error(409, 'session_closed', 'A held or cancelled session can no longer be changed.');
            return;
        }

        $scheduledAt = $session['scheduled_at'];
        if ($hasDate) {
            $scheduledAt = self::parseDateTime($data['scheduled_at']);
            if ($data['scheduled_at'] !== null && $scheduledAt === null) {
                Response::error(400, 'invalid_scheduled_at', 'scheduled_at must be YYYY-MM-DD HH:MM or null.');
                return;
            }
        }

        $status = (string) ($data['status'] ?? '');
        if ($hasStatus && !in_array($status, ['scheduled', 'unscheduled', 'done', 'canceled'], true)) {
            Response::error(400, 'invalid_status', 'status must be scheduled, unscheduled, done or canceled.');
            return;
        }

        if (!$hasStatus) {
            // Setting or clearing the date is what moves a session between the two open states.
            $status = $scheduledAt === null ? 'unscheduled' : 'scheduled';
        } elseif ($status === 'scheduled' && $scheduledAt === null) {
            Response::error(400, 'missing_scheduled_at', 'A scheduled session needs scheduled_at.');
            return;
        } elseif ($status === 'unscheduled') {
            $scheduledAt = null;
        } elseif ($status === 'done' && $scheduledAt === null) {
            // Held without ever being planned: the moment it is recorded is when it happened.
            $scheduledAt = date('Y-m-d H:i:s');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE package_sessions SET scheduled_at = :scheduled_at, status = :status WHERE id = :id')
                ->execute(['scheduled_at' => $scheduledAt, 'status' => $status, 'id' => $session['id']]);

            if ($status === 'done' || $status === 'canceled') {
                // One statement, so two sessions closing at once can't both miss the other.
                $pdo->prepare(
                    "UPDATE session_packages SET status = 'completed'
                     WHERE id = :id AND status = 'active'
                       AND NOT EXISTS (
                         SELECT 1 FROM package_sessions
                         WHERE package_id = :package_id AND status IN ('unscheduled','scheduled')
                       )"
                )->execute(['id' => $package['id'], 'package_id' => $package['id']]);
            }

            // Same transaction, so the calendar never shows a session the table no longer agrees with.
            CalendarController::syncSessionEvent($session['id']);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['ok' => true]);
    }

    /**
     * Called by InvoiceController::markPaid, inside its transaction, when a
     * session_package invoice is settled: the package goes active and gets its
     * total_sessions empty sessions. Idempotent — a package that isn't waiting
     * for payment is left alone, so a repeat can't add sessions twice.
     */
    public static function activate(string $packageId): void
    {
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "UPDATE session_packages SET status = 'active' WHERE id = :id AND status = 'pending_payment'"
        );
        $stmt->execute(['id' => $packageId]);
        if ($stmt->rowCount() === 0) {
            return;
        }

        $stmt = $pdo->prepare('SELECT total_sessions FROM session_packages WHERE id = :id');
        $stmt->execute(['id' => $packageId]);
        $total = (int) $stmt->fetchColumn();

        $marks = implode(',', array_fill(0, $total, '(?, ?)'));
        $bind = [];
        for ($i = 0; $i < $total; $i++) {
            $bind[] = Uuid::v4();
            $bind[] = $packageId;
        }
        $pdo->prepare("INSERT INTO package_sessions (id, package_id) VALUES {$marks}")->execute($bind);
    }

    /** Called by InvoiceController::cancel: a package whose bill is void never starts. */
    public static function cancelUnpaid(string $packageId): void
    {
        Database::connection()->prepare(
            "UPDATE session_packages SET status = 'cancelled' WHERE id = :id AND status = 'pending_payment'"
        )->execute(['id' => $packageId]);
    }

    private static function listSql(): string
    {
        return "SELECT sp.id, sp.trainer_id, sp.athlete_id, sp.title, sp.total_sessions, sp.price_toman,
                       sp.discount_toman, sp.status, sp.created_at,
                       i.id AS invoice_id, i.status AS invoice_status,
                       (SELECT COUNT(*) FROM package_sessions ps WHERE ps.package_id = sp.id AND ps.status = 'done') AS done_sessions,
                       (SELECT COUNT(*) FROM package_sessions ps WHERE ps.package_id = sp.id AND ps.status = 'canceled') AS canceled_sessions,
                       tp.first_name AS trainer_first_name, tp.last_name AS trainer_last_name
                FROM session_packages sp
                JOIN profiles tp ON tp.id = sp.trainer_id
                LEFT JOIN invoices i ON i.item_type = 'session_package' AND i.item_id = sp.id";
    }

    private static function present(array $rows): array
    {
        return Cast::rows(
            $rows,
            [],
            ['total_sessions', 'price_toman', 'discount_toman', 'done_sessions', 'canceled_sessions']
        );
    }

    /** 'YYYY-MM-DD[ T]HH:MM[:SS]' or a bare date (-> 00:00) to a DATETIME string; null for null or anything else. */
    private static function parseDateTime(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return null;
        }

        foreach (['Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d\TH:i:s', 'Y-m-d\TH:i', 'Y-m-d'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!' . $format, $value);
            $errors = \DateTimeImmutable::getLastErrors();
            if ($date !== false && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $date->format('Y-m-d H:i:s');
            }
        }

        return null;
    }

    private static function packageOr404(string $id): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, trainer_id, athlete_id, status FROM session_packages WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $package = $stmt->fetch();

        if ($package === false) {
            Response::error(404, 'not_found', 'Package not found.');
            exit;
        }

        return $package;
    }
}
