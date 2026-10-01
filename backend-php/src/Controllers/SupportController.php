<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Templates;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * Support tickets from users to the platform admin — not the athlete →
 * trainer tickets (TicketController), which never reach the admin.
 *
 * Status follows whose turn it is: 'open' waits on support, 'answered'
 * waits on the user, 'closed' is done (a new reply from either side opens
 * it again). Admins need the support permission.
 */
final class SupportController
{
    public const CATEGORIES = ['bug', 'billing', 'account', 'suggestion', 'other'];
    public const STATUSES = ['open', 'answered', 'closed'];
    private const MAX_SUBJECT = 255;
    private const MAX_BODY = 3000;

    public static function ready(): bool
    {
        return Database::hasColumn('support_tickets', 'ticket_number');
    }

    // ---- The user's side ---------------------------------------------------

    public static function listMine(): void
    {
        $user = Auth::requireUser();
        if (!self::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }
        $stmt = Database::connection()->prepare(
            'SELECT t.id, t.ticket_number, t.category, t.subject, t.status, t.created_at, t.updated_at,
                    (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
             FROM support_tickets t WHERE t.user_id = :user_id ORDER BY t.updated_at DESC'
        );
        $stmt->execute(['user_id' => $user['id']]);
        Response::ok(['ready' => true, 'items' => self::castTickets($stmt->fetchAll())]);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }
        $data = Validate::body();
        $category = (string) ($data['category'] ?? 'other');
        $subject = trim((string) ($data['subject'] ?? ''));
        $body = trim((string) ($data['body'] ?? ''));

        if (!in_array($category, self::CATEGORIES, true)) {
            Response::error(400, 'invalid_category', 'دستهٔ تیکت معتبر نیست.');
            return;
        }
        if ($subject === '' || mb_strlen($subject) > self::MAX_SUBJECT) {
            Response::error(400, 'invalid_subject', 'موضوع را وارد کنید (حداکثر ۲۵۵ نویسه).');
            return;
        }
        if (!self::validBody($body)) {
            return;
        }

        $pdo = Database::connection();
        $id = Uuid::v4();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO support_tickets (id, user_id, category, subject) VALUES (:id, :user_id, :category, :subject)'
            )->execute(['id' => $id, 'user_id' => $user['id'], 'category' => $category, 'subject' => $subject]);
            self::addMessage($pdo, $id, $user['id'], false, $body);

            $number = $pdo->prepare('SELECT ticket_number FROM support_tickets WHERE id = :id');
            $number->execute(['id' => $id]);
            $number = (int) $number->fetchColumn();

            foreach (AdminAccess::holders($pdo, 'support') as $adminId) {
                Templates::notify($pdo, 'support_new', $adminId, $user['id'], 'support', [
                    'number'  => $number,
                    'name'    => self::name($user),
                    'subject' => $subject,
                ], '/admin/support?id=' . $id);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        Response::ok(['id' => $id, 'ticket_number' => $number], 201);
    }

    public static function get(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }
        $ticket = self::ticket(Database::connection(), $params['id']);
        if ($ticket === null || $ticket['user_id'] !== $user['id']) {
            Response::error(404, 'not_found', 'تیکت پیدا نشد.');
            return;
        }
        Response::ok(['ticket' => self::castTickets([$ticket])[0], 'messages' => self::messages(Database::connection(), $ticket['id'], false)]);
    }

    public static function reply(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }
        $body = trim((string) (Validate::body()['body'] ?? ''));
        if (!self::validBody($body)) {
            return;
        }
        $pdo = Database::connection();
        $ticket = self::ticket($pdo, $params['id']);
        if ($ticket === null || $ticket['user_id'] !== $user['id']) {
            Response::error(404, 'not_found', 'تیکت پیدا نشد.');
            return;
        }

        $pdo->beginTransaction();
        try {
            self::addMessage($pdo, $ticket['id'], $user['id'], false, $body);
            $pdo->prepare("UPDATE support_tickets SET status = 'open', closed_at = NULL WHERE id = :id")
                ->execute(['id' => $ticket['id']]);
            foreach (AdminAccess::holders($pdo, 'support') as $adminId) {
                Templates::notify($pdo, 'support_user_reply', $adminId, $user['id'], 'support', [
                    'number' => $ticket['ticket_number'],
                    'name'   => self::name($user),
                    'text'   => mb_substr($body, 0, 80),
                ], '/admin/support?id=' . $ticket['id']);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::ok(['ok' => true], 201);
    }

    public static function close(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }
        $stmt = Database::connection()->prepare(
            "UPDATE support_tickets SET status = 'closed', closed_at = NOW() WHERE id = :id AND user_id = :user_id AND status <> 'closed'"
        );
        $stmt->execute(['id' => $params['id'], 'user_id' => $user['id']]);
        Response::ok(['ok' => true]);
    }

    // ---- The admin's side --------------------------------------------------

    /** ?status=open|answered|closed */
    public static function adminList(): void
    {
        Auth::requireAdmin('support');
        if (!self::ready()) {
            Response::ok(['ready' => false, 'items' => [], 'counts' => ['open' => 0, 'answered' => 0, 'closed' => 0]]);
            return;
        }
        $pdo = Database::connection();
        $sql = "SELECT t.id, t.ticket_number, t.category, t.subject, t.status, t.created_at, t.updated_at, t.user_id,
                       p.first_name, p.last_name, p.email, p.phone, p.account_type,
                       (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
                FROM support_tickets t
                JOIN profiles p ON p.id = t.user_id";
        $bind = [];
        if (in_array($_GET['status'] ?? '', self::STATUSES, true)) {
            $sql .= ' WHERE t.status = :status';
            $bind['status'] = $_GET['status'];
        }
        // Waiting on support first, oldest wait at the top.
        $sql .= " ORDER BY t.status = 'open' DESC, CASE WHEN t.status = 'open' THEN t.updated_at END ASC, t.updated_at DESC LIMIT 300";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);

        $counts = ['open' => 0, 'answered' => 0, 'closed' => 0];
        foreach ($pdo->query('SELECT status, COUNT(*) AS n FROM support_tickets GROUP BY status')->fetchAll() as $row) {
            $counts[$row['status']] = (int) $row['n'];
        }

        Response::ok(['ready' => true, 'items' => self::castTickets($stmt->fetchAll()), 'counts' => $counts]);
    }

    public static function adminGet(array $params): void
    {
        Auth::requireAdmin('support');
        if (!self::requireReady()) {
            return;
        }
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT t.*, p.first_name, p.last_name, p.email, p.phone, p.account_type
             FROM support_tickets t JOIN profiles p ON p.id = t.user_id WHERE t.id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $ticket = $stmt->fetch();
        if ($ticket === false) {
            Response::error(404, 'not_found', 'تیکت پیدا نشد.');
            return;
        }
        Response::ok(['ticket' => self::castTickets([$ticket])[0], 'messages' => self::messages($pdo, $ticket['id'], true)]);
    }

    /** {body, close?} — a reply hands the turn to the user (or closes the ticket). */
    public static function adminReply(array $params): void
    {
        $admin = Auth::requireAdmin('support');
        if (!self::requireReady()) {
            return;
        }
        $data = Validate::body();
        $body = trim((string) ($data['body'] ?? ''));
        if (!self::validBody($body)) {
            return;
        }
        $pdo = Database::connection();
        $ticket = self::ticket($pdo, $params['id']);
        if ($ticket === null) {
            Response::error(404, 'not_found', 'تیکت پیدا نشد.');
            return;
        }
        $close = !empty($data['close']);

        $pdo->beginTransaction();
        try {
            self::addMessage($pdo, $ticket['id'], $admin['id'], true, $body);
            $pdo->prepare(
                'UPDATE support_tickets SET status = :status, closed_at = ' . ($close ? 'NOW()' : 'NULL') . ' WHERE id = :id'
            )->execute(['status' => $close ? 'closed' : 'answered', 'id' => $ticket['id']]);
            Templates::notify($pdo, 'support_reply', $ticket['user_id'], $admin['id'], 'support', [
                'number'  => $ticket['ticket_number'],
                'subject' => $ticket['subject'],
                'text'    => mb_substr($body, 0, 120),
            ], '/support?id=' . $ticket['id']);
            AdminController::logActivity($pdo, null, $admin['id'], $ticket['user_id'], 'support_replied', [
                'number' => (int) $ticket['ticket_number'],
                'closed' => $close,
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::ok(['ok' => true], 201);
    }

    public static function adminSetStatus(array $params): void
    {
        $admin = Auth::requireAdmin('support');
        if (!self::requireReady()) {
            return;
        }
        $status = (string) (Validate::body()['status'] ?? '');
        if (!in_array($status, self::STATUSES, true)) {
            Response::error(400, 'invalid_status', 'وضعیت معتبر نیست.');
            return;
        }
        $pdo = Database::connection();
        $ticket = self::ticket($pdo, $params['id']);
        if ($ticket === null) {
            Response::error(404, 'not_found', 'تیکت پیدا نشد.');
            return;
        }
        if ($ticket['status'] === $status) {
            Response::ok(['ok' => true]);
            return;
        }
        $pdo->prepare(
            'UPDATE support_tickets SET status = :status, closed_at = ' . ($status === 'closed' ? 'NOW()' : 'NULL') . ' WHERE id = :id'
        )->execute(['status' => $status, 'id' => $ticket['id']]);

        if ($status === 'closed') {
            Templates::notify($pdo, 'support_closed', $ticket['user_id'], $admin['id'], 'support', [
                'number'  => $ticket['ticket_number'],
                'subject' => $ticket['subject'],
            ], '/support?id=' . $ticket['id']);
        }
        AdminController::logActivity($pdo, null, $admin['id'], $ticket['user_id'], 'support_status_changed', [
            'number' => (int) $ticket['ticket_number'],
            'status' => $status,
        ]);
        Response::ok(['ok' => true]);
    }

    /** Tickets waiting on support, for the admin overview; null before the SQL. */
    public static function openCount(PDO $pdo): ?int
    {
        if (!self::ready()) {
            return null;
        }
        return (int) $pdo->query("SELECT COUNT(*) FROM support_tickets WHERE status = 'open'")->fetchColumn();
    }

    // ---- Helpers -------------------------------------------------------------

    private static function requireReady(): bool
    {
        if (self::ready()) {
            return true;
        }
        Response::error(503, 'support_not_ready', 'تیکت پشتیبانی هنوز فعال نشده است.');
        return false;
    }

    private static function validBody(string $body): bool
    {
        if ($body === '' || mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'متن پیام را وارد کنید (حداکثر ۳۰۰۰ نویسه).');
            return false;
        }
        return true;
    }

    private static function ticket(PDO $pdo, string $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM support_tickets WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    private static function addMessage(PDO $pdo, string $ticketId, string $senderId, bool $fromAdmin, string $body): void
    {
        $pdo->prepare(
            'INSERT INTO support_messages (id, ticket_id, sender_id, from_admin, body) VALUES (:id, :ticket_id, :sender_id, :from_admin, :body)'
        )->execute(['id' => Uuid::v4(), 'ticket_id' => $ticketId, 'sender_id' => $senderId, 'from_admin' => $fromAdmin ? 1 : 0, 'body' => $body]);
        // The list orders by updated_at; a new message is activity even when the status stays.
        $pdo->prepare('UPDATE support_tickets SET updated_at = NOW() WHERE id = :id')->execute(['id' => $ticketId]);
    }

    /**
     * The conversation. The user sees "پشتیبانی جیم‌لیک" for every admin
     * reply; the admin also sees which admin wrote it.
     *
     * @return list<array<string, mixed>>
     */
    private static function messages(PDO $pdo, string $ticketId, bool $forAdmin): array
    {
        $stmt = $pdo->prepare(
            "SELECT m.id, m.from_admin, m.body, m.created_at, CONCAT_WS(' ', p.first_name, p.last_name) AS sender_name
             FROM support_messages m LEFT JOIN profiles p ON p.id = m.sender_id
             WHERE m.ticket_id = :id ORDER BY m.seq ASC"
        );
        $stmt->execute(['id' => $ticketId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['from_admin'] = (bool) $row['from_admin'];
            if ($row['from_admin'] && !$forAdmin) {
                $row['sender_name'] = 'پشتیبانی جیم‌لیک';
            }
        }
        unset($row);
        return $rows;
    }

    /** @param list<array<string, mixed>> $rows */
    private static function castTickets(array $rows): array
    {
        foreach ($rows as &$row) {
            $row['ticket_number'] = (int) $row['ticket_number'];
            if (isset($row['message_count'])) {
                $row['message_count'] = (int) $row['message_count'];
            }
        }
        unset($row);
        return $rows;
    }

    private static function name(array $user): string
    {
        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
        return $name !== '' ? $name : (string) ($user['email'] ?? '');
    }
}
