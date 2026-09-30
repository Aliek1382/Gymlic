<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use SimpleXMLElement;
use Throwable;

/**
 * News: items the platform admin writes in the panel (origin 'admin') and the
 * articles of gymlic.ir copied in from its WordPress RSS feed (origin
 * 'wordpress'). Every signed-in user reads the published ones; only the
 * platform admin writes, and only admin items -- imported articles belong to
 * the website and open there.
 *
 * Text is stored and served as plain text and the client renders it as text,
 * never as HTML, so nothing an author or the feed contains can run in the panel.
 */
final class NewsController
{
    private const TIMEZONE = 'Asia/Tehran';
    private const DEFAULT_FEED_URL = 'https://gymlic.ir/feed/';
    private const MAX_TITLE = 500;
    private const MAX_SUMMARY = 1000;
    private const MAX_BODY = 50000;
    private const MAX_URL = 1024;
    private const MAX_FEED_ITEMS = 30;
    private const MAX_FEED_BYTES = 2_000_000;

    private const COLUMNS = 'id, origin, title, summary, link, image_url, is_published, published_at';

    // ---- Reading: every signed-in user -------------------------------------

    /** Published items, newest first; ?origin=admin|wordpress narrows, ?limit= (max 50) and ?offset= page. */
    public static function list(): void
    {
        Auth::requireUser();

        $origin = Validate::nullableString($_GET['origin'] ?? null);
        if ($origin !== null && !in_array($origin, ['admin', 'wordpress'], true)) {
            Response::error(400, 'invalid_origin', "origin must be 'admin' or 'wordpress'.");
            return;
        }
        $limit = max(1, min(50, (int) ($_GET['limit'] ?? 20)));
        $offset = max(0, (int) ($_GET['offset'] ?? 0));

        $sql = 'SELECT ' . self::COLUMNS . ' FROM news_items WHERE is_published = 1';
        $params = [];
        if ($origin !== null) {
            $sql .= ' AND origin = :origin';
            $params['origin'] = $origin;
        }
        // One extra row tells the client whether another page exists.
        $sql .= ' ORDER BY published_at DESC, id LIMIT ' . ($limit + 1) . ' OFFSET ' . $offset;

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $hasMore = count($rows) > $limit;
        Response::ok([
            'items'    => array_map([self::class, 'present'], array_slice($rows, 0, $limit)),
            'has_more' => $hasMore,
        ]);
    }

    /** One published item with its full body (the list leaves the body out). */
    public static function get(array $params): void
    {
        Auth::requireUser();

        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ', body FROM news_items WHERE id = :id AND is_published = 1'
        );
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();

        if ($row === false) {
            Response::error(404, 'not_found', 'News item not found.');
            return;
        }
        Response::ok(self::present($row));
    }

    // ---- Writing: platform admin -------------------------------------------

    /** Everything, drafts included, so the admin can manage what readers do not see. */
    public static function adminList(): void
    {
        Auth::requirePlatformAdmin();

        $rows = Database::connection()
            ->query('SELECT ' . self::COLUMNS . ' FROM news_items ORDER BY published_at DESC, id LIMIT 200')
            ->fetchAll();

        Response::ok(['items' => array_map([self::class, 'present'], $rows)]);
    }

    /** One item for the edit form, body included, whether or not it is published. */
    public static function adminGet(array $params): void
    {
        Auth::requirePlatformAdmin();

        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ', body FROM news_items WHERE id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();

        if ($row === false) {
            Response::error(404, 'not_found', 'News item not found.');
            return;
        }
        Response::ok(self::present($row));
    }

    public static function create(): void
    {
        $admin = Auth::requirePlatformAdmin();
        $fields = self::validatedFields(Validate::required(Validate::body(), ['title', 'body']));
        if ($fields === null) {
            return;
        }

        $id = Uuid::v4();
        Database::connection()->prepare(
            "INSERT INTO news_items (id, origin, title, summary, body, image_url, is_published, published_at, created_by)
             VALUES (:id, 'admin', :title, :summary, :body, :image_url, :is_published, :published_at, :created_by)"
        )->execute([
            'id'           => $id,
            'title'        => $fields['title'],
            'summary'      => $fields['summary'],
            'body'         => $fields['body'],
            'image_url'    => $fields['image_url'],
            'is_published' => $fields['is_published'],
            'published_at' => self::now(),
            'created_by'   => $admin['id'],
        ]);

        Response::ok(['id' => $id], 201);
    }

    public static function update(array $params): void
    {
        Auth::requirePlatformAdmin();
        $fields = self::validatedFields(Validate::required(Validate::body(), ['title', 'body']));
        if ($fields === null) {
            return;
        }

        $pdo = Database::connection();
        if (!self::isAdminItem($params['id'])) {
            Response::error(404, 'not_found', 'News item not found.');
            return;
        }

        // published_at is the moment of first publication: a typo fix must not
        // bump the item back to the top, so it is left alone here.
        $pdo->prepare(
            "UPDATE news_items
             SET title = :title, summary = :summary, body = :body, image_url = :image_url, is_published = :is_published
             WHERE id = :id AND origin = 'admin'"
        )->execute([
            'title'        => $fields['title'],
            'summary'      => $fields['summary'],
            'body'         => $fields['body'],
            'image_url'    => $fields['image_url'],
            'is_published' => $fields['is_published'],
            'id'           => $params['id'],
        ]);

        Response::ok();
    }

    public static function delete(array $params): void
    {
        Auth::requirePlatformAdmin();

        if (!self::isAdminItem($params['id'])) {
            Response::error(404, 'not_found', 'News item not found.');
            return;
        }

        Database::connection()
            ->prepare("DELETE FROM news_items WHERE id = :id AND origin = 'admin'")
            ->execute(['id' => $params['id']]);

        Response::ok();
    }

    // ---- gymlic.ir feed import (cron/news-fetch.php) ------------------------

    /**
     * Copies the newest articles of the WordPress feed into news_items and
     * returns how many were new. Safe to run as often as wanted: the UNIQUE
     * key on link_hash turns an already-imported article into a no-op, and
     * INSERT IGNORE means it never overwrites what is stored.
     *
     * The feed is read from config 'news_feed_url' when that key exists, else
     * gymlic.ir's default -- so the host's config.php needs no edit.
     */
    public static function syncFeed(): int
    {
        $config = require __DIR__ . '/../../config.php';
        $url = (string) ($config['news_feed_url'] ?? self::DEFAULT_FEED_URL);

        $xml = self::parseFeed(self::download($url));
        $insert = Database::connection()->prepare(
            "INSERT IGNORE INTO news_items (id, origin, title, summary, link, link_hash, image_url, published_at)
             VALUES (:id, 'wordpress', :title, :summary, :link, :link_hash, :image_url, :published_at)"
        );

        $added = 0;
        $seen = 0;
        foreach ($xml->channel->item as $item) {
            if (++$seen > self::MAX_FEED_ITEMS) {
                break;
            }
            // One article the database refuses must not cost the rest of the feed.
            try {
                $row = self::feedItemRow($item);
                if ($row === null) {
                    continue;
                }
                $insert->execute($row + ['id' => Uuid::v4()]);
                $added += $insert->rowCount();
            } catch (Throwable $e) {
                fwrite(STDERR, 'news item skipped: ' . $e->getMessage() . "\n");
            }
        }

        return $added;
    }

    /** The response body, or an exception naming why there is none -- the cron reports it. */
    private static function download(string $url): string
    {
        if (!preg_match('#^https?://#i', $url)) {
            throw new \RuntimeException('feed url must be http(s)');
        }
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('the PHP curl extension is not enabled on this host');
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_ENCODING       => '', // accept gzip/deflate and decode it
            CURLOPT_USERAGENT      => 'GymlicNewsFetcher/1.0',
            CURLOPT_HTTPHEADER     => ['Accept: application/rss+xml, application/xml;q=0.9, */*;q=0.5'],
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new \RuntimeException("download failed: {$error}");
        }
        if ($status !== 200) {
            throw new \RuntimeException("feed answered HTTP {$status}");
        }
        if (strlen((string) $body) > self::MAX_FEED_BYTES) {
            throw new \RuntimeException('feed is unreasonably large');
        }
        return (string) $body;
    }

    private static function parseFeed(string $body): SimpleXMLElement
    {
        $previous = libxml_use_internal_errors(true);
        // LIBXML_NONET: a feed must never make the server fetch anything else.
        $xml = simplexml_load_string($body, SimpleXMLElement::class, LIBXML_NONET | LIBXML_NOCDATA);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if ($xml === false || !isset($xml->channel->item)) {
            throw new \RuntimeException('not an RSS feed');
        }
        return $xml;
    }

    /** @return array<string, mixed>|null null for an item without a usable title or link */
    private static function feedItemRow(SimpleXMLElement $item): ?array
    {
        $title = self::plainText((string) $item->title, self::MAX_TITLE);
        $link = trim((string) $item->link);
        if ($title === '' || !self::isHttpUrl($link)) {
            return null;
        }

        $content = (string) ($item->children('http://purl.org/rss/1.0/modules/content/')->encoded ?? '');
        $description = (string) $item->description;
        $summary = self::plainText($description !== '' ? $description : $content, self::MAX_SUMMARY);

        $published = null;
        try {
            $published = new DateTimeImmutable((string) $item->pubDate);
        } catch (Throwable) {
            // A missing or odd date falls back to the import time below.
        }

        return [
            'title'        => $title,
            'summary'      => $summary !== '' ? $summary : null,
            'link'         => $link,
            'link_hash'    => md5($link),
            'image_url'    => self::feedImage($item, $content),
            'published_at' => ($published ?? new DateTimeImmutable())
                ->setTimezone(new DateTimeZone(self::TIMEZONE))
                ->format('Y-m-d H:i:s'),
        ];
    }

    /** media:content / enclosure if the feed has them, else the first <img> of the post body. */
    private static function feedImage(SimpleXMLElement $item, string $content): ?string
    {
        $candidates = [];
        foreach ($item->children('http://search.yahoo.com/mrss/')->content ?? [] as $media) {
            $candidates[] = (string) $media->attributes()->url;
        }
        if (isset($item->enclosure)) {
            $candidates[] = (string) $item->enclosure->attributes()->url;
        }
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $match)) {
            $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        foreach ($candidates as $candidate) {
            if (self::isHttpUrl($candidate)) {
                return $candidate;
            }
        }
        return null;
    }

    // ---- Shared -------------------------------------------------------------

    /** HTML to plain text, collapsed to single spaces and cut to $max characters. */
    private static function plainText(string $html, int $max): string
    {
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));
        return mb_strlen($text) > $max ? rtrim(mb_substr($text, 0, $max - 1)) . '…' : $text;
    }

    /** Only http(s): the value ends up in an href or an img src. */
    private static function isHttpUrl(string $value): bool
    {
        return $value !== ''
            && mb_strlen($value) <= self::MAX_URL
            && preg_match('#^https?://[^\s]+$#i', $value) === 1;
    }

    private static function now(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone(self::TIMEZONE)))->format('Y-m-d H:i:s');
    }

    private static function isAdminItem(string $id): bool
    {
        $stmt = Database::connection()->prepare("SELECT 1 FROM news_items WHERE id = :id AND origin = 'admin'");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() !== false;
    }

    /**
     * The writable fields of an admin item, trimmed and checked, or null after
     * ending the request with 400.
     *
     * @return array{title: string, summary: ?string, body: string, image_url: ?string, is_published: int}|null
     */
    private static function validatedFields(array $data): ?array
    {
        $title = is_string($data['title']) ? trim($data['title']) : '';
        $body = is_string($data['body']) ? trim($data['body']) : '';
        $summary = isset($data['summary']) && is_string($data['summary']) ? trim($data['summary']) : '';
        $image = isset($data['image_url']) && is_string($data['image_url']) ? trim($data['image_url']) : '';

        if ($title === '' || mb_strlen($title) > self::MAX_TITLE) {
            Response::error(400, 'invalid_title', 'title must be 1 to ' . self::MAX_TITLE . ' characters.');
            return null;
        }
        if ($body === '' || mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'body must be 1 to ' . self::MAX_BODY . ' characters.');
            return null;
        }
        if (mb_strlen($summary) > self::MAX_SUMMARY) {
            Response::error(400, 'invalid_summary', 'summary must be at most ' . self::MAX_SUMMARY . ' characters.');
            return null;
        }
        if ($image !== '' && !self::isHttpUrl($image)) {
            Response::error(400, 'invalid_image_url', 'image_url must be an http(s) address.');
            return null;
        }

        return [
            'title'        => $title,
            'summary'      => $summary !== '' ? $summary : null,
            'body'         => $body,
            'image_url'    => $image !== '' ? $image : null,
            'is_published' => ($data['is_published'] ?? true) ? 1 : 0,
        ];
    }

    /** published_at goes out as an ISO timestamp with its offset, so the client never guesses the zone. */
    private static function present(array $row): array
    {
        $row['is_published'] = (bool) $row['is_published'];
        $row['published_at'] = (new DateTimeImmutable($row['published_at'], new DateTimeZone(self::TIMEZONE)))->format('c');
        return $row;
    }
}
