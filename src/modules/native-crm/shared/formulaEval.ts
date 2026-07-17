/**
 * Safe arithmetic formula evaluator — CSP-friendly replacement for
 * `new Function(...)`, which the app's Content-Security-Policy
 * (script-src 'self', no 'unsafe-eval') blocks in the browser.
 *
 * Supports: numbers (int/decimal), + - * / %, parentheses, unary +/-.
 * Formulas reference other fields/columns as {key} tokens, substituted
 * with their current values before parsing.
 */

/** Recursive-descent parser. Throws on any invalid syntax. */
export function evalArithmetic(input: string): number {
  const s = input.replace(/\s+/g, '');
  if (!s) throw new Error('empty expression');
  let pos = 0;

  const peek = () => s[pos];
  const eat = (ch: string) => { if (s[pos] !== ch) throw new Error(`expected ${ch}`); pos++; };

  function parseExpr(): number {
    let v = parseTerm();
    while (pos < s.length && (peek() === '+' || peek() === '-')) {
      const op = s[pos++];
      const rhs = parseTerm();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseFactor();
    while (pos < s.length && (peek() === '*' || peek() === '/' || peek() === '%')) {
      const op = s[pos++];
      const rhs = parseFactor();
      v = op === '*' ? v * rhs : op === '/' ? v / rhs : v % rhs;
    }
    return v;
  }

  function parseFactor(): number {
    if (peek() === '+') { pos++; return parseFactor(); }
    if (peek() === '-') { pos++; return -parseFactor(); }
    if (peek() === '(') {
      pos++;
      const v = parseExpr();
      eat(')');
      return v;
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(pos));
    if (!m) throw new Error(`unexpected character at ${pos}`);
    pos += m[0].length;
    return parseFloat(m[0]);
  }

  const result = parseExpr();
  if (pos !== s.length) throw new Error('trailing characters');
  if (!Number.isFinite(result)) throw new Error('non-finite result');
  return result;
}

/** Round float noise (0.1+0.2 → 0.3) without truncating real precision. */
function tidy(n: number): string {
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}

/**
 * Substitute {key} tokens with values and evaluate.
 * Missing/blank values count as 0; currency objects unwrap to .amount.
 * Returns '—' when the formula is invalid.
 */
export function evalFormulaWith(formula: string, values: Record<string, any>): string {
  try {
    const expr = formula.replace(/\{(\w+)\}/g, (_, k) => {
      const v = values[k];
      if (v === null || v === undefined || v === '') return '0';
      if (typeof v === 'object' && !Array.isArray(v) && 'amount' in v) return String((v as any).amount ?? 0);
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? String(n) : '0';
    });
    return tidy(evalArithmetic(expr));
  } catch {
    return '—';
  }
}

/**
 * Validity check for builder live-previews: substitutes every {key} with 1
 * and evaluates. Returns { valid, result }.
 */
export function previewFormula(formula: string): { valid: boolean; result: string } {
  if (!formula?.trim()) return { valid: true, result: '' };
  try {
    const expr = formula.replace(/\{(\w+)\}/g, '1');
    return { valid: true, result: tidy(evalArithmetic(expr)) };
  } catch {
    return { valid: false, result: '' };
  }
}
