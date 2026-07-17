import { COUNTRY_CODE_OPTIONS, splitPhone, joinPhone } from './countryCodes';

interface PhoneInputProps {
  value:          string;
  onChange:       (fullValue: string) => void;
  defaultDialCode?: string;
  placeholder?:   string;
  className?:     string;
}

/** Phone input with a country-code dropdown; stores/emits a single "+91 9876543210"-style string. */
export default function PhoneInput({ value, onChange, defaultDialCode = '+91', placeholder, className }: PhoneInputProps) {
  const { dialCode, number } = splitPhone(value, defaultDialCode);

  return (
    <div className={`flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-brand-400 overflow-hidden ${className ?? ''}`}>
      <select
        value={dialCode}
        onChange={(e) => onChange(joinPhone(e.target.value, number))}
        className="shrink-0 border-0 border-r border-gray-200 bg-gray-50 pl-2 pr-1 py-2 text-sm text-gray-700 focus:outline-none focus:ring-0"
      >
        {COUNTRY_CODE_OPTIONS.map((c) => (
          <option key={`${c.iso2}-${c.dialCode}`} value={c.dialCode}>
            {c.flag} {c.dialCode}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={number}
        onChange={(e) => onChange(joinPhone(dialCode, e.target.value))}
        placeholder={placeholder}
        className="flex-1 min-w-0 border-0 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
