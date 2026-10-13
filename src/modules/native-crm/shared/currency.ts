export const CUR_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  SGD: 'S$',
  AED: 'AED ',
  SAR: 'SAR ',
};

/**
 * Resolves the currency symbol from a currency code (e.g. 'INR' -> '₹', 'USD' -> '$').
 * Defaults to the tenant CRM currency '₹' when currencyCode is undefined, empty, or not configured.
 */
export function getCurrencySymbol(currencyCode?: string | null): string {
  if (!currencyCode) return '₹';
  const c = String(currencyCode).trim().toUpperCase();
  return CUR_SYMBOL[c] ?? (c === 'INR' ? '₹' : '$');
}

/**
 * Formats a numeric amount with the given currency symbol (defaults to '₹').
 */
export function fmtMoney(n: number | undefined | null, cur = '₹'): string {
  return `${cur}${n != null ? Number(n).toFixed(2) : '0.00'}`;
}
