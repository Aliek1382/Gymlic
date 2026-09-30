<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\PointsService;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * Formal athlete → trainer requests. Deliberately separate from `messages`
 * (the free-form chat): a ticket has a category, a status and a tracking
 * number, and nothing here reads or writes the messages table.
 */
final class TicketController
{
    private const MAX_BODY = 2000;
    private const MAX_SUBJECT = 255;
    private const CATEGORIES = ['plan', 'nutrition', 'injury', 'other'];
    private const STATUSES = ['open', 'in_progress', 'closed'];

    /** The trainers an athlete may open a ticket with — feeds the "new ticket" form. */
    public static function trainers(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            "SELECT p.id, p.first_name, p.last_name
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.trainer_id
             WHERE ta.athlete_id = :athlete_id AND ta.status = 'active'
             ORDER BY p.first_name, p.last_name"
        );
        $stmt->execute(['athlete_id' => $user['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    /** POST /tickets — the athlete opens one; ticket and first message are one transaction. */
    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['trainer_id', 'subject', 'body']);

        $trainerId = (string) $data['trainer_id'];
        $category = (string) ($data['category'] ?? 'other');
        $subject = trim((string) $data['subject']);
        $body = trim((string) $data['body']);

        if (!in_array($category, self::CATEGORIES, true)) {
            Response::error(400, 'invalid_category', 'Unknown ticket category.');
            return;
        }
        if ($subject === '' || mb_strlen($subject) > self::MAX_SUBJECT) {
            Response::error(400, 'invalid_subject', 'A subject must be between 1 and 255 characters.');
            return;
        }
        if ($body === '' || mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'A message must be between 1 and 2000 characters.');
            return;
        }
        Acl::require(Acl::isTrainerOf($trainerId, $user['id']), 'That person is not your trainer.');

        $pdo = Database::connection();
        $ticketId = Uuid::v4();

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO tickets (id, trainer_id, athlete_id, category, subject)
                 VALUES (:id, :trainer_id, :athlete_id, :category, :subject)'
            )->execute([
                'id'         => $ticketId,
                'trainer_id' => $trainerId,
                'athlete_id' => $user['id'],
                'category'   => $category,
                'subject'    => $subject,
            ]);
            self::insertMessage($ticketId, $user['id'], $body);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT ticket_number FROM tickets WHERE id = :id');
        $stmt->execute(['id' => $ticketId]);
        $number = (int) $stmt->fetchColumn();

        AuthController::notify(
            $pdo,
            $trainerId,
            $user['id'],
            'ticket',
            'تیکت جدید',
            self::actorName($user) . ': ' . $subject,
            '/tickets?id=' . $ticketId
        );

        Response::ok(['id' => $ticketId, 'ticket_number' => $number], 201);
    }

    /** GET /tickets?status= — the trainer's tickets. */
    public static function listForTrainer(): void
    {
        $user = Auth::requireUser();
        $status = isset($_GET['status']) ? (string) $_GET['status'] : null;
        if ($status !== null && $status !== '' && !in_array($status, self::STATUSES, true)) {
            Response::error(400, 'invalid_status', 'Unknown ticket status.');
            return;
        }

        Response::ok(['items' => self::list('trainer_id', $user['id'], $status ?: null)]);
    }

    /** GET /tickets/mine — the athlete's tickets. */
    public static function listMine(): void
    {
        $user = Auth::requireUser();
        Response::ok(['items' => self::list('athlete_id', $user['id'], null)]);
    }

    private static function list(string $column, string $userId, ?string $status): array
    {
        // $column is one of two literals chosen above, never client input.
        $sql = "SELECT t.id, t.ticket_number, t.category, t.subject, t.status,
                       t.created_at, t.updated_at, t.closed_at,
                       t.trainer_id, t.athlete_id,
                       tp.first_name AS trainer_first_name, tp.last_name AS trainer_last_name,
                       ap.first_name AS athlete_first_name, ap.last_name AS athlete_last_name
                FROM tickets t
                JOIN profiles tp ON tp.id = t.trainer_id
                JOIN profiles ap ON ap.id = t.athlete_id
                WHERE t.{$column} = :user_id";
        $params = ['user_id' => $userId];
        if ($status !== null) {
            $sql .= ' AND t.status = :status';
            $params['status'] = $status;
        }
        $sql .= ' ORDER BY t.updated_at DESC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /** GET /tickets/{id} — the ticket plus its messages; only its two parties. */
    public static function get(array $params): void
    {
        $user = Auth::requireUser();
        $ticket = self::ticketOr404($params['id']);
        Acl::require(self::isParty($ticket, $user['id']));

        $stmt = Database::connection()->prepare(
            'SELECT m.id, m.sender_id, m.body, m.created_at, p.first_name, p.last_name, p.avatar_url
             FROM ticket_messages m
             JOIN profiles p ON p.id = m.sender_id
             WHERE m.ticket_id = :id
             ORDER BY m.created_at ASC, m.id ASC'
        );
        $stmt->execute(['id' => $ticket['id']]);
        $messages = $stmt->fetchAll();

        $stmt = Database::connection()->prepare(
            'SELECT id, first_name, last_name FROM profiles WHERE id IN (:t, :a)'
        );
        $stmt->execute(['t' => $ticket['trainer_id'], 'a' => $ticket['athlete_id']]);
        $names = array_column($stmt->fetchAll(), null, 'id');

        $ticket['trainer_first_name'] = $names[$ticket['trainer_id']]['first_name'] ?? null;
        $ticket['trainer_last_name'] = $names[$ticket['trainer_id']]['last_name'] ?? null;
        $ticket['athlete_first_name'] = $names[$ticket['athlete_id']]['first_name'] ?? null;
        $ticket['athlete_last_name'] = $names[$ticket['athlete_id']]['last_name'] ?? null;

        Response::ok(['ticket' => $ticket, 'messages' => $messages]);
    }

    /** POST /tickets/{id}/messages — either party; a message on a closed ticket reopens it. */
    public static function addMessage(array $params): void
    {
        $user = Auth::requireUser();
        $ticket = self::ticketOr404($params['id']);
        Acl::require(self::isParty($ticket, $user['id']));

        $data = Validate::required(Validate::body(), ['body']);
        $body = trim((string) $data['body']);
        if ($body === '' || mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'A message must be between 1 and 2000 characters.');
            return;
        }

        $pdo = Database::connection();

        // Read before the insert: only the trainer's first reply on a ticket
        // earns points, so back-and-forth chat can't farm them.
        $isFirstTrainerReply = false;
        if ($ticket['trainer_id'] === $user['id']) {
            $prior = $pdo->prepare('SELECT 1 FROM ticket_messages WHERE ticket_id = :id AND sender_id = :sender LIMIT 1');
            $prior->execute(['id' => $ticket['id'], 'sender' => $user['id']]);
            $isFirstTrainerReply = $prior->fetchColumn() === false;
        }

        $messageId = self::insertMessage($ticket['id'], $user['id'], $body);
        if ($isFirstTrainerReply) {
            PointsService::award($user['id'], 'ticket_answered');
        }

        // Closing a ticket doesn't lock it: new activity reopens it. MySQL
        // applies SET left to right, so closed_at must be read before status
        // is rewritten. The explicit updated_at keeps the list ordered by latest activity even
        // when the status doesn't change.
        $pdo->prepare(
            "UPDATE tickets
             SET closed_at = CASE WHEN status = 'closed' THEN NULL ELSE closed_at END,
                 status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
                 updated_at = NOW()
             WHERE id = :id"
        )->execute(['id' => $ticket['id']]);

        $recipientId = $ticket['trainer_id'] === $user['id'] ? $ticket['athlete_id'] : $ticket['trainer_id'];
        AuthController::notify(
            $pdo,
            $recipientId,
            $user['id'],
            'ticket',
            'پاسخ جدید در تیکت #' . $ticket['ticket_number'],
            self::actorName($user) . ': ' . mb_substr($body, 0, 80),
            '/tickets?id=' . $ticket['id']
        );

        Response::ok(['id' => $messageId], 201);
    }

    /** PATCH /tickets/{id}/status — trainer only. */
    public static function setStatus(array $params): void
    {
        $user = Auth::requireUser();
        $ticket = self::ticketOr404($params['id']);
        Acl::require($ticket['trainer_id'] === $user['id'], 'Only the trainer can change a ticket status.');

        $data = Validate::required(Validate::body(), ['status']);
        $status = (string) $data['status'];
        if (!in_array($status, self::STATUSES, true)) {
            Response::error(400, 'invalid_status', 'Unknown ticket status.');
            return;
        }

        $pdo = Database::connection();
        // closed_at is stamped on the transition only; re-sending 'closed'
        // must not move it.
        $pdo->prepare(
            "UPDATE tickets
             SET closed_at = CASE
                   WHEN :s1 = 'closed' THEN COALESCE(closed_at, NOW())
                   ELSE NULL
                 END,
                 status = :s2
             WHERE id = :id"
        )->execute(['s1' => $status, 's2' => $status, 'id' => $ticket['id']]);

        if ($status !== $ticket['status']) {
            AuthController::notify(
                $pdo,
                $ticket['athlete_id'],
                $user['id'],
                'ticket',
                'وضعیت تیکت #' . $ticket['ticket_number'] . ' تغییر کرد',
                $ticket['subject'],
                '/tickets?id=' . $ticket['id']
            );
        }

        Response::ok(['ok' => true, 'status' => $status]);
    }

    private static function insertMessage(string $ticketId, string $senderId, string $body): string
    {
        $id = Uuid::v4();
        Database::connection()->prepare(
            'INSERT INTO ticket_messages (id, ticket_id, sender_id, body)
             VALUES (:id, :ticket_id, :sender_id, :body)'
        )->execute(['id' => $id, 'ticket_id' => $ticketId, 'sender_id' => $senderId, 'body' => $body]);

        return $id;
    }

    private static function ticketOr404(string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM tickets WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $ticket = $stmt->fetch();

        if ($ticket === false) {
            Response::error(404, 'not_found', 'Ticket not found.');
            exit;
        }

        return $ticket;
    }

    private static function isParty(array $ticket, string $userId): bool
    {
        return $ticket['trainer_id'] === $userId || $ticket['athlete_id'] === $userId;
    }

    private static function actorName(array $user): string
    {
        return trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    }
}
