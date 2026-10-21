import { parsePhoneNumber } from 'libphonenumber-js';

// RevivaTech fork: numbers typed without a country code are read as UK numbers
// first (07565 621896 → +447565621896). When that isn't a valid UK number, the
// agent is asked which country's prefix to use.
export const DEFAULT_PHONE_COUNTRY = 'GB';

// Below this many digits a national number is still being typed, so don't ask
// for a country yet.
const MIN_DIGITS_FOR_COUNTRY_PROMPT = 7;

const PHONE_LIKE = /^(\+|00)?[\d\s().-]+$/;

const compact = value => value.trim().replace(/[\s().-]/g, '');

/** Digits with an optional + or 00 prefix and common separators. */
export const looksLikePhoneNumber = value => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return PHONE_LIKE.test(trimmed) && /\d/.test(trimmed);
};

const isInternational = value => /^(\+|00)/.test(value.trim());

/** A phone number typed without + or 00, i.e. one that needs a country. */
export const isNationalNumber = value =>
  looksLikePhoneNumber(value) && !isInternational(value);

/**
 * The E.164 form of a typed number, or null when it isn't a valid number.
 * "+…" and "00…" are international; anything else is a national number of
 * `country` (UK by default).
 */
export const toE164 = (value, country = DEFAULT_PHONE_COUNTRY) => {
  if (!looksLikePhoneNumber(value)) return null;

  let number = compact(value);
  if (number.startsWith('00')) number = `+${number.slice(2)}`;

  try {
    const parsed = number.startsWith('+')
      ? parsePhoneNumber(number)
      : parsePhoneNumber(number, country);
    return parsed?.isValid() ? parsed.number : null;
  } catch (error) {
    return null;
  }
};

/**
 * True when the agent typed a complete-looking national number that isn't a
 * valid UK number, so we need to ask which country it belongs to.
 */
export const needsCountryPrefix = value =>
  isNationalNumber(value) &&
  compact(value).replace(/\D/g, '').length >= MIN_DIGITS_FOR_COUNTRY_PROMPT &&
  !toE164(value, DEFAULT_PHONE_COUNTRY);
