import {
  looksLikePhoneNumber,
  toE164,
  needsCountryPrefix,
} from '../phoneNumberHelper';

describe('phoneNumberHelper', () => {
  describe('looksLikePhoneNumber', () => {
    it('accepts digits with common separators and prefixes', () => {
      [
        '07565621896',
        '07565 621896',
        '(0756) 562-1896',
        '+447565621896',
        '0044 7565 621896',
      ].forEach(value => expect(looksLikePhoneNumber(value)).toBe(true));
    });

    it('rejects names, emails and empty input', () => {
      ['john', 'john@example.com', '', '+', '   ', null].forEach(value =>
        expect(looksLikePhoneNumber(value)).toBe(false)
      );
    });
  });

  describe('toE164', () => {
    it('reads a number without a country code as UK first', () => {
      expect(toE164('07565621896')).toBe('+447565621896');
      expect(toE164('07565 621 896')).toBe('+447565621896');
      expect(toE164('020 7946 0958')).toBe('+442079460958');
    });

    it('keeps international numbers as typed, including 00 prefixes', () => {
      expect(toE164('+447565621896')).toBe('+447565621896');
      expect(toE164('+55 11 98765 4321')).toBe('+5511987654321');
      expect(toE164('0055 11 98765 4321')).toBe('+5511987654321');
    });

    it('uses the chosen country for national numbers', () => {
      expect(toE164('11 98765 4321', 'BR')).toBe('+5511987654321');
      expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678');
    });

    it('returns null for numbers that are not valid', () => {
      expect(toE164('0756')).toBeNull();
      expect(toE164('11 98765 4321')).toBeNull();
      expect(toE164('+44 12')).toBeNull();
      expect(toE164('john')).toBeNull();
    });
  });

  describe('needsCountryPrefix', () => {
    it('is false for valid UK numbers and international numbers', () => {
      expect(needsCountryPrefix('07565621896')).toBe(false);
      expect(needsCountryPrefix('+5511987654321')).toBe(false);
      expect(needsCountryPrefix('005511987654321')).toBe(false);
    });

    it('is false while a number is still short or for non-numbers', () => {
      expect(needsCountryPrefix('07565')).toBe(false);
      expect(needsCountryPrefix('john@example.com')).toBe(false);
    });

    it('is true for a complete-looking number that is not a valid UK number', () => {
      expect(needsCountryPrefix('11 98765 4321')).toBe(true);
      expect(needsCountryPrefix('0612345678')).toBe(true);
    });
  });
});
