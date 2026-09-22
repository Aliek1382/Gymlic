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

/**
 * The club's own income ledger. occurred_at is a DATE here rather than the
 * timestamp Postgres used, so the "store it at local noon" trick the client
 * needed to keep an entry on its own calendar day is gone.
 */
final class RevenueController
{
    private const CATEGORIES = ['membership', 'session', 'product', 'other'];

    public static function list(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::isClubMember($user['id'], $clubId));

        $stmt = Database::connection()->prepare(
            'SELECT r.id, r.member_id, r.amount, r.category, r.occurred_at, r.note,
                    p.first_name, p.last_name
             FROM revenue_entries r
             LEFT JOIN profiles p ON p.id = r.member_id
             WHERE r.club_id = :club_id
             ORDER BY r.occurred_at DESC, r.created_at DESC'
        );
        $stmt->execute(['club_id' => $clubId]);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), ['amount'])]);
    }

    public static function create(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $data = Validate::required(Validate::body(), ['amount', 'occurred_at']);
        $category = (string) ($data['category'] ?? 'membership');

        if (!in_array($category, self::CATEGORIES, true)) {
            Response::error(400, 'invalid_category', 'Unknown revenue category.');
            return;
        }
        if ((float) $data['amount'] <= 0) {
            Response::error(400, 'invalid_amount', 'Amount must be greater than zero.');
            return;
        }

        $id = Uuid::v4();
        Database::connection()->prepare(
            'INSERT INTO revenue_entries (id, club_id, amount, member_id, category, note, recorded_by, occurred_at)
             VALUES (:id, :club_id, :amount, :member_id, :category, :note, :recorded_by, :occurred_at)'
        )->execute([
            'id'          => $id,
            'club_id'     => $clubId,
            'amount'      => $data['amount'],
            'member_id'   => Validate::nullableString($data['member_id'] ?? null),
            'category'    => $category,
            'note'        => Validate::nullableString($data['note'] ?? null),
            'recorded_by' => $user['id'],
            'occurred_at' => (string) $data['occurred_at'],
        ]);

        Response::ok(['id' => $id], 201);
    }

    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $entry = self::entryForManager($user, $params['id']);
        $data = Validate::body();

        $fields = [];
        $bind = ['id' => $entry['id']];

        foreach (['amount', 'member_id', 'category', 'note', 'occurred_at'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $data[$key] === null ? null : (string) $data[$key];
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }
        if (isset($bind['category']) && !in_array($bind['category'], self::CATEGORIES, true)) {
            Response::error(400, 'invalid_category', 'Unknown revenue category.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE revenue_entries SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();
        $entry = self::entryForManager($user, $params['id']);

        Database::connection()
            ->prepare('DELETE FROM revenue_entries WHERE id = :id')
            ->execute(['id' => $entry['id']]);

        Response::ok(['ok' => true]);
    }

    private static function entryForManager(array $user, string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT id, club_id FROM revenue_entries WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $entry = $stmt->fetch();

        if ($entry === false) {
            Response::error(404, 'not_found', 'Revenue entry not found.');
            exit;
        }
        Acl::require(Acl::managesClub($user['id'], $entry['club_id']));

        return $entry;
    }
}
