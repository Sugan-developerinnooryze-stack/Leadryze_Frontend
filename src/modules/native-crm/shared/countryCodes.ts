import { COUNTRIES } from './phone-currency-data';

export interface CountryDialCode {
  iso2: string;
  name: string;
  flag: string;
  dialCode: string;   // e.g. "+91"
}

// De-duplicated by dial code (US/CA both +1 → keep first) and sorted numerically,
// for the "pick a default code" dropdown in FS Settings.
const seenDial = new Set<string>();
export const COUNTRY_CODE_OPTIONS: CountryDialCode[] = COUNTRIES
  .filter((c) => (seenDial.has(c.dial) ? false : (seenDial.add(c.dial), true)))
  .map((c) => ({ iso2: c.code, name: c.name, flag: c.flag, dialCode: c.dial }))
  .sort((a, b) => parseInt(a.dialCode.slice(1), 10) - parseInt(b.dialCode.slice(1), 10));

/**
 * Splits a stored phone value into { dialCode, number }.
 * Accepts "+91 9876543210", "+919876543210", or a bare number (no code).
 */
export function splitPhone(value: string | undefined | null, fallbackDialCode: string): { dialCode: string; number: string } {
  const v = (value ?? '').trim();
  if (!v.startsWith('+')) return { dialCode: fallbackDialCode, number: v };

  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (v.startsWith(c.dial)) {
      return { dialCode: c.dial, number: v.slice(c.dial.length).trim() };
    }
  }
  return { dialCode: fallbackDialCode, number: v };
}

export function joinPhone(dialCode: string, number: string): string {
  const n = number.trim();
  return n ? `${dialCode} ${n}` : '';
}
