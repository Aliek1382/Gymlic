<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * A trainer's private notes: about one athlete (athlete_id set) or general
 * (athlete_id NULL). Every query is scoped to trainer_id = the caller, and
 * there is deliberately no athlete-facing endpoint and no notification --
 * nobody but the trainer ever learns these exist.
 *
 * Not to be confused with the single `note` field on an athlete's profile
 * (AthleteController::updateNote).
 */
final class NoteController
{
    private const MAX_CONTENT = 5000;

    /** With ?athlete_id=, that athlete's notes; without, the general ones. */
    public static function list(): void
    {
        $user = Auth::requireUser();
        $athleteId = Validate::nullableString($_GET['athlete_id'] ?? null);

        $sql = "SELECT id, athlete_id, content, created_at, updated_at
                FROM notes
                WHERE trainer_id = :trainer_id AND ";
        $params = ['trainer_id' => $user['id']];
        if ($athleteId === null) {
            $sql .= 'athlete_id IS NULL';
        } else {
            $sql .= 'athlete_id = :athlete_id';
            $params['athlete_id'] = $athleteId;
        }

        $stmt = Database::connection()->prepare($sql . ' ORDER BY created_at DESC');
        $stmt->execute($params);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['content']);

        $content = self::content($data['content']);
        if ($content === null) {
            return;
        }

        $athleteId = isset($data['athlete_id']) ? Validate::nullableString((string) $data['athlete_id']) : null;
        if ($athleteId !== null) {
            Acl::require(Acl::isTrainerOf($user['id'], $athleteId), 'This athlete is not on your roster.');
        }

        $id = Uuid::v4();
        Database::connection()->prepare(
            "INSERT INTO notes (id, trainer_id, athlete_id, content)
             VALUES (:id, :trainer_id, :athlete_id, :content)"
        )->execute([
            'id'         => $id,
            'trainer_id' => $user['id'],
            'athlete_id' => $athleteId,
            'content'    => $content,
        ]);

        Response::ok(['id' => $id], 201);
    }

    /** Only the text changes; a note never moves between athletes. */
    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['content']);

        $content = self::content($data['content']);
        if ($content === null) {
            return;
        }

        if (!self::isOwnedBy($params['id'], $user['id'])) {
            Response::error(404, 'not_found', 'Note not found.');
            return;
        }

        Database::connection()->prepare('UPDATE notes SET content = :content WHERE id = :id AND trainer_id = :trainer_id')
            ->execute(['content' => $content, 'id' => $params['id'], 'trainer_id' => $user['id']]);

        Response::ok();
    }

    public static function delete(array $params): void
    {
        $user = Auth::requireUser();

        if (!self::isOwnedBy($params['id'], $user['id'])) {
            Response::error(404, 'not_found', 'Note not found.');
            return;
        }

        Database::connection()->prepare('DELETE FROM notes WHERE id = :id AND trainer_id = :trainer_id')
            ->execute(['id' => $params['id'], 'trainer_id' => $user['id']]);

        Response::ok();
    }

    /** Someone else's note answers 404, same as a missing one -- no probing for ids. */
    private static function isOwnedBy(string $noteId, string $trainerId): bool
    {
        $stmt = Database::connection()->prepare('SELECT 1 FROM notes WHERE id = :id AND trainer_id = :trainer_id');
        $stmt->execute(['id' => $noteId, 'trainer_id' => $trainerId]);
        return $stmt->fetch() !== false;
    }

    /** The trimmed text, or null after ending the request with 400. */
    private static function content(mixed $raw): ?string
    {
        $content = is_string($raw) ? trim($raw) : '';
        if ($content === '' || mb_strlen($content) > self::MAX_CONTENT) {
            Response::error(400, 'invalid_content', 'content must be 1 to ' . self::MAX_CONTENT . ' characters.');
            return null;
        }
        return $content;
    }
}
