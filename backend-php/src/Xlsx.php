<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * A minimal .xlsx writer: several sheets of plain rows, the first row bold
 * and frozen, right-to-left. No library: the host has no Composer, and an
 * .xlsx is only a few XML files in a zip, written here by hand. Text goes in
 * as inline strings, so Persian needs nothing special; numbers stay numbers,
 * so Excel can sum them.
 *
 * It streams: each sheet goes out row by row as it is added (deflated on
 * the fly with zlib), so a big export holds one row in memory, not the
 * file. Without zlib a sheet is stored uncompressed via a temp file.
 *
 *   $xlsx = new Xlsx(static function (string $bytes): void { echo $bytes; });
 *   $xlsx->sheet('آمار ماهانه', [['ماه', 'تعداد'], ['مهر ۱۴۰۵', 3]], [18, 10]);
 *   $xlsx->finish();
 */
final class Xlsx
{
    /** Excel's limit on one cell's text. */
    public const MAX_CELL = 32767;

    /** @var callable(string): void */
    private $out;

    private bool $deflate;

    private int $offset = 0;

    private string $central = '';

    private int $entries = 0;

    /** @var list<string> */
    private array $sheets = [];

    /** @var array{name: string, ctx: mixed, hash: \HashContext, size: int, packed: int, start: int, temp: mixed}|null */
    private ?array $entry = null;

    private string $buffer = '';

    private int $time;

    private int $date;

    /**
     * @param callable(string): void $out receives the file, piece by piece
     * @param bool|null $deflate null: whenever the host has zlib (false is for tests)
     */
    public function __construct(callable $out, ?bool $deflate = null)
    {
        $this->out = $out;
        $this->deflate = ($deflate ?? true) && function_exists('deflate_init');
        // DOS date and time of now, which a zip entry carries.
        $t = getdate();
        $this->time = ($t['hours'] << 11) | ($t['minutes'] << 5) | intdiv($t['seconds'], 2);
        $this->date = (($t['year'] - 1980) << 9) | ($t['mon'] << 5) | $t['mday'];
    }

    /**
     * Writes one sheet.
     *
     * @param iterable<list<string|int|float|null>> $rows the first is the header
     * @param list<int> $widths column widths in characters
     */
    public function sheet(string $name, iterable $rows, array $widths = []): self
    {
        // Excel refuses a sheet name over 31 characters or with []:*?/\ in it.
        $this->sheets[] = mb_substr(str_replace(['[', ']', ':', '*', '?', '/', '\\'], ' ', $name), 0, 31);
        $this->open('xl/worksheets/sheet' . count($this->sheets) . '.xml');

        $cols = '';
        foreach ($widths as $i => $width) {
            $cols .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $width . '" customWidth="1"/>';
        }
        $this->write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView rightToLeft="1" workbookViewId="0">'
            . '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . ($cols !== '' ? '<cols>' . $cols . '</cols>' : '')
            . '<sheetData>');

        $r = 0;
        foreach ($rows as $row) {
            $r++;
            $cells = '';
            foreach (array_values($row) as $c => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $ref = self::column($c) . $r;
                $style = $r === 1 ? ' s="1"' : '';
                $cells .= is_int($value) || is_float($value)
                    ? '<c r="' . $ref . '"' . $style . '><v>' . $value . '</v></c>'
                    : '<c r="' . $ref . '"' . $style . ' t="inlineStr"><is><t xml:space="preserve">'
                        . self::esc(mb_substr((string) $value, 0, self::MAX_CELL)) . '</t></is></c>';
            }
            $this->write('<row r="' . $r . '">' . $cells . '</row>');
        }

        $this->write('</sheetData></worksheet>');
        $this->close();
        return $this;
    }

    /** Writes the workbook around the sheets and the zip's directory. Call once, last. */
    public function finish(): void
    {
        $sheets = '';
        $rels = '';
        $types = '';
        foreach ($this->sheets as $i => $name) {
            $n = $i + 1;
            $sheets .= '<sheet name="' . self::esc($name) . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
            $rels .= '<Relationship Id="rId' . $n . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $n . '.xml"/>';
            $types .= '<Override PartName="/xl/worksheets/sheet' . $n . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }
        $rels .= '<Relationship Id="rId' . (count($this->sheets) + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

        $files = [
            'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                . '<bookViews><workbookView/></bookViews><sheets>' . $sheets . '</sheets></workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $rels . '</Relationships>',
            'xl/styles.xml' => self::STYLES,
            '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                . '</Relationships>',
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                . '<Default Extension="xml" ContentType="application/xml"/>'
                . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                . $types . '</Types>',
        ];
        foreach ($files as $name => $contents) {
            $this->open($name);
            $this->write($contents);
            $this->close();
        }

        $this->emit($this->central
            . pack('VvvvvVVv', 0x06054b50, 0, 0, $this->entries, $this->entries, strlen($this->central), $this->offset, 0));
    }

    /** The whole file as a string, for something small. @param callable(self): void $fill */
    public static function toString(callable $fill): string
    {
        $file = '';
        $xlsx = new self(static function (string $bytes) use (&$file): void {
            $file .= $bytes;
        });
        $fill($xlsx);
        $xlsx->finish();
        return $file;
    }

    // Font 0 plain, font 1 bold; style 1 is the header row.
    private const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts>'
        . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
        . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';

    // ---- The zip, one entry at a time --------------------------------------
    //
    // With zlib an entry is deflated as it is written; its CRC and sizes are
    // only known at the end, so they follow it in a data descriptor (flag
    // bit 3), which Excel and LibreOffice read. Without zlib it is stored,
    // and stored data can't use a descriptor, so it goes to a temp file
    // (memory up to 2 MB, then disk) and out once its CRC is known.

    private function open(string $name): void
    {
        $this->entry = [
            'name'   => $name,
            'ctx'    => $this->deflate ? deflate_init(ZLIB_ENCODING_RAW, ['level' => 6]) : null,
            'hash'   => hash_init('crc32b'),
            'size'   => 0,
            'packed' => 0,
            'start'  => $this->offset,
            'temp'   => $this->deflate ? null : fopen('php://temp/maxmemory:2097152', 'w+b'),
        ];
        if ($this->deflate) {
            $this->emit(pack('V', 0x04034b50) . $this->header(0x0008, 8, 0, 0, 0, $name) . $name);
        }
    }

    private function write(string $data): void
    {
        $this->buffer .= $data;
        if (strlen($this->buffer) >= 65536) {
            $this->flush(false);
        }
    }

    private function flush(bool $final): void
    {
        $e = &$this->entry;
        $data = $this->buffer;
        $this->buffer = '';
        hash_update($e['hash'], $data);
        $e['size'] += strlen($data);
        if ($e['ctx'] !== null) {
            $packed = deflate_add($e['ctx'], $data, $final ? ZLIB_FINISH : ZLIB_NO_FLUSH);
            $e['packed'] += strlen($packed);
            $this->emit($packed);
        } else {
            fwrite($e['temp'], $data);
        }
    }

    private function close(): void
    {
        $this->flush(true);
        $e = $this->entry;
        $crc = (int) hexdec(hash_final($e['hash']));

        if ($this->deflate) {
            $this->emit(pack('VVVV', 0x08074b50, $crc, $e['packed'], $e['size']));
            $flag = 0x0008;
            $method = 8;
            $packed = $e['packed'];
        } else {
            $flag = 0;
            $method = 0;
            $packed = $e['size'];
            $this->emit(pack('V', 0x04034b50) . $this->header(0, 0, $crc, $packed, $e['size'], $e['name']) . $e['name']);
            rewind($e['temp']);
            while (!feof($e['temp'])) {
                $this->emit((string) fread($e['temp'], 65536));
            }
            fclose($e['temp']);
        }

        $this->central .= pack('V', 0x02014b50) . pack('v', 20)
            . $this->header($flag, $method, $crc, $packed, $e['size'], $e['name'])
            . pack('vvvVV', 0, 0, 0, 0, $e['start']) . $e['name'];
        $this->entries++;
        $this->entry = null;
    }

    /** From "version needed" to "extra length", the part local and central headers share. */
    private function header(int $flag, int $method, int $crc, int $packed, int $size, string $name): string
    {
        return pack('vvvvvVVVvv', 20, $flag, $method, $this->time, $this->date, $crc, $packed, $size, strlen($name), 0);
    }

    private function emit(string $bytes): void
    {
        if ($bytes === '') {
            return;
        }
        $this->offset += strlen($bytes);
        ($this->out)($bytes);
    }

    /** 0 → A, 25 → Z, 26 → AA. */
    private static function column(int $index): string
    {
        $name = '';
        for ($n = $index + 1; $n > 0; $n = intdiv($n - 1, 26)) {
            $name = chr(65 + ($n - 1) % 26) . $name;
        }
        return $name;
    }

    private static function esc(string $text): string
    {
        // XML 1.0 has no place for most control characters; a stray one
        // would make Excel call the whole file corrupt.
        $text = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $text);
        return htmlspecialchars($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
