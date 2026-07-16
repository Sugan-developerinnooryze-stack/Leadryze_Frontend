export interface CountryEntry {
  code:  string;
  name:  string;
  dial:  string;
  flag:  string;
}

export interface CurrencyEntry {
  code:   string;
  name:   string;
  symbol: string;
}

export const COUNTRIES: CountryEntry[] = [
  { code: 'IN',  name: 'India',              dial: '+91',   flag: '🇮🇳' },
  { code: 'US',  name: 'United States',      dial: '+1',    flag: '🇺🇸' },
  { code: 'GB',  name: 'United Kingdom',     dial: '+44',   flag: '🇬🇧' },
  { code: 'CA',  name: 'Canada',             dial: '+1',    flag: '🇨🇦' },
  { code: 'AU',  name: 'Australia',          dial: '+61',   flag: '🇦🇺' },
  { code: 'DE',  name: 'Germany',            dial: '+49',   flag: '🇩🇪' },
  { code: 'FR',  name: 'France',             dial: '+33',   flag: '🇫🇷' },
  { code: 'IT',  name: 'Italy',              dial: '+39',   flag: '🇮🇹' },
  { code: 'ES',  name: 'Spain',              dial: '+34',   flag: '🇪🇸' },
  { code: 'NL',  name: 'Netherlands',        dial: '+31',   flag: '🇳🇱' },
  { code: 'CH',  name: 'Switzerland',        dial: '+41',   flag: '🇨🇭' },
  { code: 'SE',  name: 'Sweden',             dial: '+46',   flag: '🇸🇪' },
  { code: 'NO',  name: 'Norway',             dial: '+47',   flag: '🇳🇴' },
  { code: 'DK',  name: 'Denmark',            dial: '+45',   flag: '🇩🇰' },
  { code: 'FI',  name: 'Finland',            dial: '+358',  flag: '🇫🇮' },
  { code: 'JP',  name: 'Japan',              dial: '+81',   flag: '🇯🇵' },
  { code: 'CN',  name: 'China',              dial: '+86',   flag: '🇨🇳' },
  { code: 'KR',  name: 'South Korea',        dial: '+82',   flag: '🇰🇷' },
  { code: 'SG',  name: 'Singapore',          dial: '+65',   flag: '🇸🇬' },
  { code: 'MY',  name: 'Malaysia',           dial: '+60',   flag: '🇲🇾' },
  { code: 'TH',  name: 'Thailand',           dial: '+66',   flag: '🇹🇭' },
  { code: 'ID',  name: 'Indonesia',          dial: '+62',   flag: '🇮🇩' },
  { code: 'PH',  name: 'Philippines',        dial: '+63',   flag: '🇵🇭' },
  { code: 'VN',  name: 'Vietnam',            dial: '+84',   flag: '🇻🇳' },
  { code: 'PK',  name: 'Pakistan',           dial: '+92',   flag: '🇵🇰' },
  { code: 'BD',  name: 'Bangladesh',         dial: '+880',  flag: '🇧🇩' },
  { code: 'LK',  name: 'Sri Lanka',          dial: '+94',   flag: '🇱🇰' },
  { code: 'NP',  name: 'Nepal',              dial: '+977',  flag: '🇳🇵' },
  { code: 'AE',  name: 'UAE',                dial: '+971',  flag: '🇦🇪' },
  { code: 'SA',  name: 'Saudi Arabia',       dial: '+966',  flag: '🇸🇦' },
  { code: 'QA',  name: 'Qatar',              dial: '+974',  flag: '🇶🇦' },
  { code: 'KW',  name: 'Kuwait',             dial: '+965',  flag: '🇰🇼' },
  { code: 'BH',  name: 'Bahrain',            dial: '+973',  flag: '🇧🇭' },
  { code: 'OM',  name: 'Oman',               dial: '+968',  flag: '🇴🇲' },
  { code: 'JO',  name: 'Jordan',             dial: '+962',  flag: '🇯🇴' },
  { code: 'TR',  name: 'Turkey',             dial: '+90',   flag: '🇹🇷' },
  { code: 'IL',  name: 'Israel',             dial: '+972',  flag: '🇮🇱' },
  { code: 'EG',  name: 'Egypt',              dial: '+20',   flag: '🇪🇬' },
  { code: 'ZA',  name: 'South Africa',       dial: '+27',   flag: '🇿🇦' },
  { code: 'NG',  name: 'Nigeria',            dial: '+234',  flag: '🇳🇬' },
  { code: 'KE',  name: 'Kenya',              dial: '+254',  flag: '🇰🇪' },
  { code: 'GH',  name: 'Ghana',              dial: '+233',  flag: '🇬🇭' },
  { code: 'TZ',  name: 'Tanzania',           dial: '+255',  flag: '🇹🇿' },
  { code: 'UG',  name: 'Uganda',             dial: '+256',  flag: '🇺🇬' },
  { code: 'BR',  name: 'Brazil',             dial: '+55',   flag: '🇧🇷' },
  { code: 'MX',  name: 'Mexico',             dial: '+52',   flag: '🇲🇽' },
  { code: 'AR',  name: 'Argentina',          dial: '+54',   flag: '🇦🇷' },
  { code: 'CO',  name: 'Colombia',           dial: '+57',   flag: '🇨🇴' },
  { code: 'CL',  name: 'Chile',              dial: '+56',   flag: '🇨🇱' },
  { code: 'RU',  name: 'Russia',             dial: '+7',    flag: '🇷🇺' },
  { code: 'PL',  name: 'Poland',             dial: '+48',   flag: '🇵🇱' },
  { code: 'NZ',  name: 'New Zealand',        dial: '+64',   flag: '🇳🇿' },
];

export const CURRENCIES: CurrencyEntry[] = [
  { code: 'INR', name: 'Indian Rupee',        symbol: '₹'   },
  { code: 'USD', name: 'US Dollar',           symbol: '$'   },
  { code: 'EUR', name: 'Euro',                symbol: '€'   },
  { code: 'GBP', name: 'Pound Sterling',      symbol: '£'   },
  { code: 'JPY', name: 'Japanese Yen',        symbol: '¥'   },
  { code: 'CNY', name: 'Chinese Yuan',        symbol: '¥'   },
  { code: 'AUD', name: 'Australian Dollar',   symbol: 'A$'  },
  { code: 'CAD', name: 'Canadian Dollar',     symbol: 'C$'  },
  { code: 'CHF', name: 'Swiss Franc',         symbol: 'Fr'  },
  { code: 'SGD', name: 'Singapore Dollar',    symbol: 'S$'  },
  { code: 'HKD', name: 'Hong Kong Dollar',    symbol: 'HK$' },
  { code: 'NOK', name: 'Norwegian Krone',     symbol: 'kr'  },
  { code: 'SEK', name: 'Swedish Krona',       symbol: 'kr'  },
  { code: 'DKK', name: 'Danish Krone',        symbol: 'kr'  },
  { code: 'NZD', name: 'New Zealand Dollar',  symbol: 'NZ$' },
  { code: 'MXN', name: 'Mexican Peso',        symbol: '$'   },
  { code: 'BRL', name: 'Brazilian Real',      symbol: 'R$'  },
  { code: 'ARS', name: 'Argentine Peso',      symbol: '$'   },
  { code: 'CLP', name: 'Chilean Peso',        symbol: '$'   },
  { code: 'COP', name: 'Colombian Peso',      symbol: '$'   },
  { code: 'AED', name: 'UAE Dirham',          symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal',         symbol: '﷼'   },
  { code: 'QAR', name: 'Qatari Riyal',        symbol: '﷼'   },
  { code: 'KWD', name: 'Kuwaiti Dinar',       symbol: 'KD'  },
  { code: 'BHD', name: 'Bahraini Dinar',      symbol: 'BD'  },
  { code: 'OMR', name: 'Omani Rial',          symbol: 'ر.ع' },
  { code: 'TRY', name: 'Turkish Lira',        symbol: '₺'   },
  { code: 'ILS', name: 'Israeli Shekel',      symbol: '₪'   },
  { code: 'EGP', name: 'Egyptian Pound',      symbol: 'E£'  },
  { code: 'ZAR', name: 'South African Rand',  symbol: 'R'   },
  { code: 'NGN', name: 'Nigerian Naira',      symbol: '₦'   },
  { code: 'KES', name: 'Kenyan Shilling',     symbol: 'KSh' },
  { code: 'GHS', name: 'Ghanaian Cedi',       symbol: '₵'   },
  { code: 'THB', name: 'Thai Baht',           symbol: '฿'   },
  { code: 'IDR', name: 'Indonesian Rupiah',   symbol: 'Rp'  },
  { code: 'MYR', name: 'Malaysian Ringgit',   symbol: 'RM'  },
  { code: 'PHP', name: 'Philippine Peso',     symbol: '₱'   },
  { code: 'VND', name: 'Vietnamese Dong',     symbol: '₫'   },
  { code: 'KRW', name: 'South Korean Won',    symbol: '₩'   },
  { code: 'PKR', name: 'Pakistani Rupee',     symbol: '₨'   },
  { code: 'BDT', name: 'Bangladeshi Taka',    symbol: '৳'   },
  { code: 'LKR', name: 'Sri Lankan Rupee',    symbol: '₨'   },
  { code: 'NPR', name: 'Nepalese Rupee',      symbol: '₨'   },
  { code: 'RUB', name: 'Russian Ruble',       symbol: '₽'   },
  { code: 'PLN', name: 'Polish Zloty',        symbol: 'zł'  },
  { code: 'TZS', name: 'Tanzanian Shilling',  symbol: 'TSh' },
  { code: 'UGX', name: 'Ugandan Shilling',    symbol: 'USh' },
];

export function getCountry(code: string): CountryEntry {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

export function getCurrency(code: string): CurrencyEntry {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES.find((c) => c.code === 'USD')!;
}
