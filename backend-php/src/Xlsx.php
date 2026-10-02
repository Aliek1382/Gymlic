<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * A minimal .xlsx writer: several sheets of plain rows, the first row bold
 * and frozen, right-to-left. No library: the host has no Composer, and an
 * .xlsx is only a few XML files in a zip, written here by hand (deflated
 * with zlib when the host has it, stored otherwise, which Excel reads too).
 * Text goes in as inline strings, so Persian needs nothing special; numbers
 * stay numbers, so Excel can sum them.
 *
 *   $xlsx = new Xlsx();
 *   $xlsx->sheet('آمار ماهانه', [['ماه', 'تعداد'], ['مهر ۱۴۰۵', 3]], [18, 10]);
 *   echo $xlsx->build();
 */
final class Xlsx
{
    /** @var list<array{name: string, rows: list<list<string|int|float|null>>, widths: list<int>}> */
    private array $sheets = [];

    /**
     * @param list<list<string|int|float|null>> $rows the first is the header
     * @param list<int> $widths column widths in characters
     */
    public function sheet(string $name, array $rows, array $widths = []): self
    {
        // Excel refuses a sheet name over 31 characters or with []:*?/\ in it.
        $name = mb_substr(str_replace(['[', ']', ':', '*', '?', '/', '\\'], ' ', $name), 0, 31);
        $this->sheets[] = ['name' => $name, 'rows' => $rows, 'widths' => $widths];
        return $this;
    }

    public function build(): string
    {
        $files = [
            '[Content_Types].xml' => $this->contentTypes(),
            '_rels/.rels'         => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                . '</Relationships>',
            'xl/workbook.xml'            => $this->workbook(),
            'xl/_rels/workbook.xml.rels' => $this->workbookRels(),
            'xl/styles.xml'              => self::STYLES,
        ];
        foreach ($this->sheets as $i => $sheet) {
            $files['xl/worksheets/sheet' . ($i + 1) . '.xml'] = $this->worksheet($sheet);
        }
        return self::zip($files);
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

    private function contentTypes(): string
    {
        $sheets = '';
        foreach (array_keys($this->sheets) as $i) {
            $sheets .= '<Override PartName="/xl/worksheets/sheet' . ($i + 1) . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . $sheets . '</Types>';
    }

    private function workbook(): string
    {
        $sheets = '';
        foreach ($this->sheets as $i => $sheet) {
            $sheets .= '<sheet name="' . self::esc($sheet['name']) . '" sheetId="' . ($i + 1) . '" r:id="rId' . ($i + 1) . '"/>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<bookViews><workbookView/></bookViews><sheets>' . $sheets . '</sheets></workbook>';
    }

    private function workbookRels(): string
    {
        $rels = '';
        foreach (array_keys($this->sheets) as $i) {
            $rels .= '<Relationship Id="rId' . ($i + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . ($i + 1) . '.xml"/>';
        }
        $rels .= '<Relationship Id="rId' . (count($this->sheets) + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $rels . '</Relationships>';
    }

    /** @param array{name: string, rows: list<list<string|int|float|null>>, widths: list<int>} $sheet */
    private function worksheet(array $sheet): string
    {
        $cols = '';
        foreach ($sheet['widths'] as $i => $width) {
            $cols .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $width . '" customWidth="1"/>';
        }

        $data = '';
        foreach ($sheet['rows'] as $r => $row) {
            $cells = '';
            foreach (array_values($row) as $c => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $ref = self::column($c) . ($r + 1);
                $style = $r === 0 ? ' s="1"' : '';
                $cells .= is_int($value) || is_float($value)
                    ? '<c r="' . $ref . '"' . $style . '><v>' . $value . '</v></c>'
                    : '<c r="' . $ref . '"' . $style . ' t="inlineStr"><is><t xml:space="preserve">' . self::esc((string) $value) . '</t></is></c>';
            }
            $data .= '<row r="' . ($r + 1) . '">' . $cells . '</row>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView rightToLeft="1" workbookViewId="0">'
            . '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . ($cols !== '' ? '<cols>' . $cols . '</cols>' : '')
            . '<sheetData>' . $data . '</sheetData></worksheet>';
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

    /** @param array<string, string> $files path => contents */
    private static function zip(array $files): string
    {
        $deflate = function_exists('gzdeflate');
        // DOS date and time of now, which a zip entry carries.
        $t = getdate();
        $time = ($t['hours'] << 11) | ($t['minutes'] << 5) | intdiv($t['seconds'], 2);
        $date = (($t['year'] - 1980) << 9) | ($t['mon'] << 5) | $t['mday'];

        $body = '';
        $central = '';
        foreach ($files as $name => $contents) {
            $crc = crc32($contents);
            $packed = $deflate ? (string) gzdeflate($contents, 6) : $contents;
            $method = $deflate ? 8 : 0;
            $header = pack('vvvvvVVVvv', 20, 0, $method, $time, $date, $crc, strlen($packed), strlen($contents), strlen($name), 0);
            $central .= pack('V', 0x02014b50) . pack('v', 20) . $header . pack('vvvVV', 0, 0, 0, 0, strlen($body)) . $name;
            $body .= pack('V', 0x04034b50) . $header . $name . $packed;
        }

        return $body . $central
            . pack('VvvvvVVv', 0x06054b50, 0, 0, count($files), count($files), strlen($central), strlen($body), 0);
    }
}
