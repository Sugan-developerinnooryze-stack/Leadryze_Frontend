/** Deterministic header-row detection for an uploaded Excel/CSV sheet —
 * NOT an LLM call. SheetJS's default `sheet_to_json` treats row 1 as the
 * header unconditionally, which breaks on any real file with a title/
 * metadata block before the real table (confirmed against a real client
 * file: a merged catalog title on row 1, a blank row 2, real headers on
 * row 3 — every row 1 or 2 "header" produced garbage keys and all data
 * rows were silently swallowed as though they were the header).
 *
 * Scores each of the first MAX_HEADER_SCAN_ROWS rows as a header-row
 * candidate and picks the best one — a real header row is the most fully-
 * populated row in its region, rarely all-numeric, and is followed by data
 * rows of comparable width; a merged title row is the opposite shape (1-2
 * filled cells out of many columns). Correctly leaves today's common case
 * (header already on row 1) unchanged, since row 1 still wins when it's
 * genuinely the most header-shaped row in the sheet. */

// Generous enough for a real file with a large metadata block (company
// name, report title, generated-date, several blank rows) before the real
// table — trivial cost for a sheet this shape, not a full-sheet scan.
export const MAX_HEADER_SCAN_ROWS = 50;

function cellText(c: unknown): string {
  return String(c ?? '').trim();
}

function scoreCandidateRow(row: unknown[], nextRow: unknown[] | undefined, totalCols: number): number {
  const cells = row.map(cellText);
  const nonEmpty = cells.filter((c) => c !== '').length;
  if (nonEmpty === 0) return -Infinity;

  let score = nonEmpty;

  // Heavily penalize a near-empty row relative to the sheet's real width —
  // the exact shape of a merged title row spanning only column A.
  if (nonEmpty <= 2 && totalCols > 4) score -= 10;

  // Headers are essentially never pure numbers.
  const allNumeric = cells.every((c) => c === '' || !Number.isNaN(Number(c)));
  if (allNumeric) score -= 5;

  // Reward a row whose NEXT row has a comparable or greater fill count —
  // real tabular data continuing immediately below reinforces "the table
  // starts here," distinguishing a header row from a lone metadata line.
  if (nextRow) {
    const nextNonEmpty = nextRow.map(cellText).filter((c) => c !== '').length;
    if (nextNonEmpty >= nonEmpty - 1) score += 3;
  }

  return score;
}

/** Returns the 0-based index of the row most likely to be the real header
 * row, scanning at most MAX_HEADER_SCAN_ROWS rows. */
export function detectHeaderRow(aoa: unknown[][]): number {
  const scanLimit = Math.min(aoa.length, MAX_HEADER_SCAN_ROWS);
  if (scanLimit === 0) return 0;
  const totalCols = Math.max(1, ...aoa.slice(0, scanLimit).map((r) => r.length));
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scanLimit; i++) {
    const score = scoreCandidateRow(aoa[i] ?? [], aoa[i + 1], totalCols);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

/** Builds real row objects from an array-of-arrays sheet given a chosen
 * header row index — every row after it becomes a data row (fully-blank
 * rows skipped), object-keyed by the header row's own trimmed cell values.
 * An empty header cell falls back to a positional "Column N" label rather
 * than silently dropping that column's data. */
export function buildRowsFromHeaderIndex(
  aoa: unknown[][], headerRowIndex: number,
): { headers: string[]; rows: Record<string, unknown>[] } {
  const headerRow = aoa[headerRowIndex] ?? [];
  const headers = headerRow.map((c, i) => cellText(c) || `Column ${i + 1}`);
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const raw = aoa[i] ?? [];
    if (!raw.some((c) => cellText(c) !== '')) continue; // skip fully-blank rows
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => { obj[h] = raw[idx] ?? ''; });
    rows.push(obj);
  }
  return { headers, rows };
}

/** Whether at least one detected header looks like a name/title column —
 * mirrors the backend's own title-field fallback (catalog-item.service.ts's
 * splitRowFields()) so the preview's warning agrees with what the import
 * will actually do, rather than being a second, independent guess. */
export function hasLikelyTitleColumn(headers: string[]): boolean {
  return headers.some((h) => {
    const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm.includes('name') || norm.includes('title');
  });
}
