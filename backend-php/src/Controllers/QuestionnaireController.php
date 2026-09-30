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
 * A trainer's own custom form — free text, multiple choice and number
 * questions — that they send to athletes and read the answers of. Each
 * questionnaire belongs to exactly one coach.
 *
 * Sending one creates a questionnaire_responses row (status 'assigned'); with a
 * price it also issues an invoice (item_type 'questionnaire', item_id = that
 * response's id) and, exactly like a plan, the questions stay out of the API
 * response for the athlete until the invoice stops being pending.
 *
 * Not to be confused with measurements (the fixed body-assessment table).
 */
final class QuestionnaireController
{
    private const TYPES = ['text', 'multiple_choice', 'number'];
    private const MAX_QUESTIONS = 100;
    private const MAX_OPTIONS = 50;
    private const MAX_OPTION_LENGTH = 200;
    private const MAX_TEXT_ANSWER = 5000;

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['title', 'questions']);

        $title = self::title($data['title']);
        $price = self::price($data['price_toman'] ?? null);
        $questions = self::questions($data['questions']);

        $pdo = Database::connection();
        $id = Uuid::v4();

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO questionnaires (id, coach_id, title, description, price_toman)
                 VALUES (:id, :coach_id, :title, :description, :price)'
            )->execute([
                'id'          => $id,
                'coach_id'    => $user['id'],
                'title'       => $title,
                'description' => Validate::nullableString(self::text($data['description'] ?? null)),
                'price'       => $price,
            ]);
            self::insertQuestions($id, $questions);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['id' => $id], 201);
    }

    /**
     * Title, description, price and is_active are always editable. Replacing the
     * questions is refused once someone has answered: questionnaire_answers
     * cascades from the question rows, so a replace would silently delete
     * submitted answers.
     */
    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $questionnaire = self::ownedOr404($params['id'], $user['id']);
        $data = Validate::body();

        $sets = [];
        $bind = ['id' => $questionnaire['id']];

        if (array_key_exists('title', $data)) {
            $sets[] = 'title = :title';
            $bind['title'] = self::title($data['title']);
        }
        if (array_key_exists('description', $data)) {
            $sets[] = 'description = :description';
            $bind['description'] = Validate::nullableString(self::text($data['description']));
        }
        if (array_key_exists('price_toman', $data)) {
            $sets[] = 'price_toman = :price';
            $bind['price'] = self::price($data['price_toman']);
        }
        if (array_key_exists('is_active', $data)) {
            $sets[] = 'is_active = :is_active';
            $bind['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }

        $replaceQuestions = array_key_exists('questions', $data);
        $questions = $replaceQuestions ? self::questions($data['questions']) : [];

        if ($sets === [] && !$replaceQuestions) {
            Response::error(400, 'missing_fields', 'Nothing to update.');
            return;
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            if ($replaceQuestions) {
                // Locking the questionnaire row first serialises this against a
                // submit landing at the same moment.
                $pdo->prepare('SELECT id FROM questionnaires WHERE id = :id FOR UPDATE')
                    ->execute(['id' => $questionnaire['id']]);

                if (self::submittedCount($questionnaire['id']) > 0) {
                    $pdo->rollBack();
                    Response::error(409, 'has_responses', 'سؤالات پرسشنامه‌ای که پاسخ گرفته قابل تغییر نیست. می‌توانید آن را غیرفعال کنید یا پرسشنامهٔ تازه‌ای بسازید.');
                    return;
                }

                $pdo->prepare('DELETE FROM questionnaire_questions WHERE questionnaire_id = :id')
                    ->execute(['id' => $questionnaire['id']]);
                self::insertQuestions($questionnaire['id'], $questions);
            }

            if ($sets !== []) {
                $pdo->prepare('UPDATE questionnaires SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($bind);
            } else {
                $pdo->prepare('UPDATE questionnaires SET updated_at = NOW() WHERE id = :id')
                    ->execute(['id' => $questionnaire['id']]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['ok' => true]);
    }

    /** The coach's questionnaires, with their questions and how far each has got. */
    public static function list(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT q.id, q.title, q.description, q.price_toman, q.is_active, q.created_at, q.updated_at,
                    (SELECT COUNT(*) FROM questionnaire_responses r WHERE r.questionnaire_id = q.id) AS assigned_count,
                    (SELECT COUNT(*) FROM questionnaire_responses r
                     WHERE r.questionnaire_id = q.id AND r.status = 'submitted') AS submitted_count
             FROM questionnaires q
             WHERE q.coach_id = :coach_id
             ORDER BY q.created_at DESC"
        );
        $stmt->execute(['coach_id' => $user['id']]);
        $rows = Cast::rows($stmt->fetchAll(), [], ['price_toman', 'assigned_count', 'submitted_count'], ['is_active']);

        $byQuestionnaire = self::questionsFor(array_column($rows, 'id'));
        foreach ($rows as &$row) {
            $row['questions'] = $byQuestionnaire[$row['id']] ?? [];
        }

        Response::ok(['items' => $rows]);
    }

    public static function delete(array $params): void
    {
        $user = Auth::requireUser();
        $questionnaire = self::ownedOr404($params['id'], $user['id']);
        $pdo = Database::connection();

        if (self::submittedCount($questionnaire['id']) > 0) {
            Response::error(409, 'has_responses', 'پرسشنامه‌ای که پاسخ گرفته حذف نمی‌شود. برای کنار گذاشتن آن را غیرفعال کنید.');
            return;
        }

        // A recorded payment is money the trainer has taken; it must not vanish with the form.
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM invoices i
             JOIN questionnaire_responses r ON r.id = i.item_id
             WHERE i.item_type = 'questionnaire' AND r.questionnaire_id = :id AND i.status = 'paid'"
        );
        $stmt->execute(['id' => $questionnaire['id']]);
        if ((int) $stmt->fetchColumn() > 0) {
            Response::error(409, 'has_paid_invoice', 'برای این پرسشنامه پرداخت ثبت شده و حذف نمی‌شود. آن را غیرفعال کنید.');
            return;
        }

        $pdo->beginTransaction();
        try {
            // invoices.item_id has no FK, so the unpaid invoices of the
            // responses that are about to cascade away are removed by hand.
            $pdo->prepare(
                "DELETE FROM invoices
                 WHERE item_type = 'questionnaire'
                   AND item_id IN (SELECT id FROM questionnaire_responses WHERE questionnaire_id = :id)"
            )->execute(['id' => $questionnaire['id']]);
            $pdo->prepare('DELETE FROM questionnaires WHERE id = :id')->execute(['id' => $questionnaire['id']]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['ok' => true]);
    }

    /** Sends the questionnaire to one athlete; a priced one issues its invoice in the same step. */
    public static function assign(array $params): void
    {
        $user = Auth::requireUser();
        $questionnaire = self::ownedOr404($params['id'], $user['id']);
        $data = Validate::required(Validate::body(), ['athlete_id']);
        $athleteId = (string) $data['athlete_id'];

        Acl::require(Acl::isTrainerOf($user['id'], $athleteId), 'This athlete is not on your roster.');

        if ((int) $questionnaire['is_active'] !== 1) {
            Response::error(409, 'inactive', 'پرسشنامهٔ غیرفعال را نمی‌توان ارسال کرد.');
            return;
        }

        $pdo = Database::connection();
        $responseId = Uuid::v4();
        $invoiceId = null;
        $price = $questionnaire['price_toman'] === null ? null : (int) $questionnaire['price_toman'];

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO questionnaire_responses (id, questionnaire_id, athlete_id) VALUES (:id, :questionnaire_id, :athlete_id)'
            )->execute(['id' => $responseId, 'questionnaire_id' => $questionnaire['id'], 'athlete_id' => $athleteId]);

            if ($price !== null && $price > 0) {
                $invoiceId = InvoiceController::issue($user['id'], $athleteId, 'questionnaire', $responseId, $price);
            }

            $pdo->commit();
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            // UNIQUE(questionnaire_id, athlete_id): already sent to this athlete.
            if ($e->getCode() === '23000') {
                Response::error(409, 'already_assigned', 'این پرسشنامه قبلاً برای این ورزشکار ارسال شده است.');
                return;
            }
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        AuthController::notify(
            $pdo,
            $athleteId,
            $user['id'],
            'questionnaire_assigned',
            'پرسشنامهٔ جدید',
            $invoiceId === null
                ? 'مربی شما پرسشنامه «' . $questionnaire['title'] . '» را برایتان فرستاد.'
                : 'برای پرسشنامه «' . $questionnaire['title'] . '» فاکتوری به مبلغ ' . number_format($price) . ' تومان صادر شد.',
            '/questionnaires',
            ['response_id' => $responseId, 'questionnaire_id' => $questionnaire['id']]
        );

        Response::ok(['id' => $responseId, 'invoice_id' => $invoiceId], 201);
    }

    /**
     * The athlete's questionnaires. A response behind a pending invoice comes
     * back `locked` with only the invoice summary — its questions are not sent.
     */
    public static function listMine(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT r.id, r.questionnaire_id, r.status, r.submitted_at, r.created_at,
                    q.title, q.description, q.price_toman,
                    tp.first_name AS trainer_first_name, tp.last_name AS trainer_last_name
             FROM questionnaire_responses r
             JOIN questionnaires q ON q.id = r.questionnaire_id
             JOIN profiles tp ON tp.id = q.coach_id
             WHERE r.athlete_id = :athlete_id
             ORDER BY r.created_at DESC"
        );
        $stmt->execute(['athlete_id' => $user['id']]);
        $rows = Cast::rows($stmt->fetchAll(), [], ['price_toman']);

        $locked = InvoiceController::pendingByItem('questionnaire', array_column($rows, 'id'));
        $open = array_values(array_filter($rows, static fn (array $row): bool => !isset($locked[$row['id']])));
        $questions = self::questionsFor(array_unique(array_column($open, 'questionnaire_id')));
        $answers = self::answersFor(array_column(array_filter($open, static fn (array $row): bool => $row['status'] === 'submitted'), 'id'));

        foreach ($rows as &$row) {
            $row['locked'] = isset($locked[$row['id']]);
            $row['invoice'] = $locked[$row['id']] ?? null;
            $row['questions'] = $row['locked'] ? [] : ($questions[$row['questionnaire_id']] ?? []);
            $row['answers'] = $row['locked'] ? [] : ($answers[$row['id']] ?? []);
        }

        Response::ok(['items' => $rows]);
    }

    public static function submit(array $params): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT r.id, r.athlete_id, r.status, r.questionnaire_id, q.coach_id, q.title
             FROM questionnaire_responses r
             JOIN questionnaires q ON q.id = r.questionnaire_id
             WHERE r.id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $response = $stmt->fetch();

        if ($response === false) {
            Response::error(404, 'not_found', 'Questionnaire not found.');
            return;
        }
        Acl::require($response['athlete_id'] === $user['id'], 'This questionnaire was not sent to you.');

        if ($response['status'] !== 'assigned') {
            Response::error(409, 'already_submitted', 'شما قبلاً به این پرسشنامه پاسخ داده‌اید.');
            return;
        }
        if (InvoiceController::isLocked('questionnaire', $response['id'])) {
            Response::error(409, 'invoice_pending', 'برای پاسخ‌دادن، ابتدا هزینهٔ پرسشنامه را با مربی تسویه کنید.');
            return;
        }

        $data = Validate::required(Validate::body(), ['answers']);
        if (!is_array($data['answers'])) {
            Response::error(400, 'invalid_answers', 'answers must be an array.');
            return;
        }

        $questions = self::questionsFor([$response['questionnaire_id']])[$response['questionnaire_id']] ?? [];
        $values = self::validateAnswers($questions, $data['answers']);
        if (is_string($values)) {
            Response::error(400, 'invalid_answers', $values);
            return;
        }

        $pdo->beginTransaction();
        try {
            // The status guard makes a double-click or a second tab a no-op instead of a second set of answers.
            $stmt = $pdo->prepare(
                "UPDATE questionnaire_responses SET status = 'submitted', submitted_at = NOW()
                 WHERE id = :id AND status = 'assigned'"
            );
            $stmt->execute(['id' => $response['id']]);
            if ($stmt->rowCount() === 0) {
                $pdo->rollBack();
                Response::error(409, 'already_submitted', 'شما قبلاً به این پرسشنامه پاسخ داده‌اید.');
                return;
            }

            if ($values !== []) {
                $marks = implode(',', array_fill(0, count($values), '(?, ?, ?, ?)'));
                $bind = [];
                foreach ($values as $questionId => $value) {
                    array_push($bind, Uuid::v4(), $response['id'], $questionId, $value);
                }
                $pdo->prepare("INSERT INTO questionnaire_answers (id, response_id, question_id, value) VALUES {$marks}")
                    ->execute($bind);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        AuthController::notify(
            $pdo,
            $response['coach_id'],
            $user['id'],
            'questionnaire_submitted',
            'پاسخ جدید',
            'یکی از ورزشکارانتان به پرسشنامه «' . $response['title'] . '» پاسخ داد.',
            '/questionnaires',
            ['response_id' => $response['id'], 'questionnaire_id' => $response['questionnaire_id']]
        );

        Response::ok(['ok' => true]);
    }

    /** For the coach: the questions plus every submitted response with its answers. */
    public static function responses(array $params): void
    {
        $user = Auth::requireUser();
        $questionnaire = self::ownedOr404($params['id'], $user['id']);
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT r.id, r.athlete_id, r.submitted_at, p.first_name AS athlete_first_name, p.last_name AS athlete_last_name
             FROM questionnaire_responses r
             JOIN profiles p ON p.id = r.athlete_id
             WHERE r.questionnaire_id = :id AND r.status = 'submitted'
             ORDER BY r.submitted_at DESC"
        );
        $stmt->execute(['id' => $questionnaire['id']]);
        $rows = $stmt->fetchAll();

        $answers = self::answersFor(array_column($rows, 'id'));
        foreach ($rows as &$row) {
            $row['answers'] = $answers[$row['id']] ?? [];
        }

        Response::ok([
            'questionnaire' => ['id' => $questionnaire['id'], 'title' => $questionnaire['title']],
            'questions'     => self::questionsFor([$questionnaire['id']])[$questionnaire['id']] ?? [],
            'items'         => $rows,
        ]);
    }

    // ---------------------------------------------------------------- helpers

    /**
     * Checks the submitted answers against the questions and returns
     * question_id => value for the ones actually answered — or an error message.
     *
     * @param array<int, array<string, mixed>> $questions
     * @return array<string, string>|string
     */
    private static function validateAnswers(array $questions, array $answers): array|string
    {
        $byQuestion = [];
        foreach ($answers as $answer) {
            if (!is_array($answer) || !isset($answer['question_id']) || !is_string($answer['question_id'])) {
                return 'Each answer needs a question_id.';
            }
            if (isset($byQuestion[$answer['question_id']])) {
                return 'A question can only be answered once.';
            }
            $byQuestion[$answer['question_id']] = $answer['value'] ?? null;
        }

        $known = array_column($questions, null, 'id');
        if (array_diff_key($byQuestion, $known) !== []) {
            return 'An answer refers to a question that is not part of this questionnaire.';
        }

        $values = [];
        foreach ($questions as $question) {
            $raw = $byQuestion[$question['id']] ?? null;
            $value = is_scalar($raw) ? trim((string) $raw) : '';

            if ($value === '') {
                if ($question['is_required']) {
                    return 'به سؤال «' . $question['label'] . '» پاسخ دهید.';
                }
                continue;
            }

            if ($question['type'] === 'number') {
                $value = str_replace(['٫', '٬', ','], ['.', '', ''], $value);
                if (!is_numeric($value)) {
                    return 'پاسخ سؤال «' . $question['label'] . '» باید عدد باشد.';
                }
            } elseif ($question['type'] === 'multiple_choice') {
                if (!in_array($value, $question['options'], true)) {
                    return 'پاسخ سؤال «' . $question['label'] . '» باید یکی از گزینه‌ها باشد.';
                }
            } elseif (mb_strlen($value) > self::MAX_TEXT_ANSWER) {
                return 'پاسخ سؤال «' . $question['label'] . '» بیش از حد طولانی است.';
            }

            $values[$question['id']] = $value;
        }

        return $values;
    }

    /**
     * @param string[] $questionnaireIds
     * @return array<string, array<int, array<string, mixed>>> questionnaire_id => questions in order
     */
    private static function questionsFor(array $questionnaireIds): array
    {
        $questionnaireIds = array_values($questionnaireIds);
        if ($questionnaireIds === []) {
            return [];
        }

        $marks = implode(',', array_fill(0, count($questionnaireIds), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT id, questionnaire_id, type, label, options, is_required, sort_order
             FROM questionnaire_questions
             WHERE questionnaire_id IN ({$marks})
             ORDER BY sort_order, id"
        );
        $stmt->execute($questionnaireIds);

        $grouped = [];
        foreach ($stmt->fetchAll() as $row) {
            $options = $row['options'] === null ? null : json_decode((string) $row['options'], true);
            $grouped[$row['questionnaire_id']][] = [
                'id'          => $row['id'],
                'type'        => $row['type'],
                'label'       => $row['label'],
                'options'     => $row['type'] === 'multiple_choice' ? (is_array($options) ? array_values($options) : []) : null,
                'is_required' => (bool) $row['is_required'],
                'sort_order'  => (int) $row['sort_order'],
            ];
        }
        return $grouped;
    }

    /**
     * @param string[] $responseIds
     * @return array<string, array<int, array{question_id: string, value: ?string}>>
     */
    private static function answersFor(array $responseIds): array
    {
        $responseIds = array_values($responseIds);
        if ($responseIds === []) {
            return [];
        }

        $marks = implode(',', array_fill(0, count($responseIds), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT response_id, question_id, value FROM questionnaire_answers WHERE response_id IN ({$marks})"
        );
        $stmt->execute($responseIds);

        $grouped = [];
        foreach ($stmt->fetchAll() as $row) {
            $grouped[$row['response_id']][] = ['question_id' => $row['question_id'], 'value' => $row['value']];
        }
        return $grouped;
    }

    /** @param array<int, array{type: string, label: string, options: ?array, is_required: bool}> $questions */
    private static function insertQuestions(string $questionnaireId, array $questions): void
    {
        $marks = implode(',', array_fill(0, count($questions), '(?, ?, ?, ?, ?, ?, ?)'));
        $bind = [];
        foreach ($questions as $index => $question) {
            array_push(
                $bind,
                Uuid::v4(),
                $questionnaireId,
                $question['type'],
                $question['label'],
                $question['options'] === null ? null : json_encode($question['options'], JSON_UNESCAPED_UNICODE),
                $question['is_required'] ? 1 : 0,
                $index
            );
        }

        Database::connection()->prepare(
            "INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
             VALUES {$marks}"
        )->execute($bind);
    }

    /** Validated, normalised questions from the request body; ends the request with 400 on the first problem. */
    private static function questions(mixed $raw): array
    {
        if (!is_array($raw) || !array_is_list($raw) || $raw === []) {
            self::fail('questions must be a non-empty list.');
        }
        if (count($raw) > self::MAX_QUESTIONS) {
            self::fail('A questionnaire can have at most ' . self::MAX_QUESTIONS . ' questions.');
        }

        $questions = [];
        foreach ($raw as $i => $item) {
            $n = $i + 1;
            if (!is_array($item)) {
                self::fail("Question {$n} is invalid.");
            }

            $type = (string) ($item['type'] ?? '');
            if (!in_array($type, self::TYPES, true)) {
                self::fail("Question {$n}: type must be text, multiple_choice or number.");
            }

            $label = is_string($item['label'] ?? null) ? trim($item['label']) : '';
            if ($label === '' || mb_strlen($label) > 500) {
                self::fail("Question {$n}: label must be 1 to 500 characters.");
            }

            $options = null;
            if ($type === 'multiple_choice') {
                $options = self::options($item['options'] ?? null, $n);
            }

            $questions[] = [
                'type'        => $type,
                'label'       => $label,
                'options'     => $options,
                'is_required' => !array_key_exists('is_required', $item) || filter_var($item['is_required'], FILTER_VALIDATE_BOOLEAN),
            ];
        }

        return $questions;
    }

    private static function options(mixed $raw, int $n): array
    {
        if (!is_array($raw) || !array_is_list($raw)) {
            self::fail("Question {$n}: options must be a list.");
        }

        $options = [];
        foreach ($raw as $option) {
            $option = is_string($option) ? trim($option) : '';
            if ($option === '' || mb_strlen($option) > self::MAX_OPTION_LENGTH) {
                self::fail("Question {$n}: each option must be 1 to " . self::MAX_OPTION_LENGTH . ' characters.');
            }
            $options[] = $option;
        }

        if (count($options) < 2 || count($options) > self::MAX_OPTIONS) {
            self::fail("Question {$n}: a multiple choice question needs 2 to " . self::MAX_OPTIONS . ' options.');
        }
        if (count(array_unique($options)) !== count($options)) {
            self::fail("Question {$n}: options must be different from each other.");
        }

        return $options;
    }

    private static function title(mixed $raw): string
    {
        $title = is_string($raw) ? trim($raw) : '';
        if ($title === '' || mb_strlen($title) > 255) {
            self::fail('title must be 1 to 255 characters.');
        }
        return $title;
    }

    /** NULL (or 0, or blank) means free; otherwise a positive whole number of toman. */
    private static function price(mixed $raw): ?int
    {
        if ($raw === null || $raw === '' || $raw === 0 || $raw === '0') {
            return null;
        }
        $price = filter_var($raw, FILTER_VALIDATE_INT);
        if ($price === false || $price < 0) {
            self::fail('price_toman must be a positive whole number or empty.');
        }
        return $price;
    }

    private static function text(mixed $raw): ?string
    {
        return is_string($raw) ? trim($raw) : null;
    }

    private static function fail(string $message): never
    {
        Response::error(400, 'invalid_input', $message);
        exit;
    }

    private static function submittedCount(string $questionnaireId): int
    {
        $stmt = Database::connection()->prepare(
            "SELECT COUNT(*) FROM questionnaire_responses WHERE questionnaire_id = :id AND status = 'submitted'"
        );
        $stmt->execute(['id' => $questionnaireId]);
        return (int) $stmt->fetchColumn();
    }

    private static function ownedOr404(string $id, string $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, coach_id, title, price_toman, is_active FROM questionnaires WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $questionnaire = $stmt->fetch();

        if ($questionnaire === false) {
            Response::error(404, 'not_found', 'Questionnaire not found.');
            exit;
        }
        Acl::require($questionnaire['coach_id'] === $userId, 'This questionnaire is not yours.');

        return $questionnaire;
    }
}
