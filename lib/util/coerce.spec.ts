import { coerceToNull, coerceToUndefined } from './coerce';

describe('util/coerce', () => {
  describe('coerceToNull', () => {
    it('should return null', () => {
      expect(coerceToNull(undefined)).toBeNull();
      expect(coerceToNull(null)).toBeNull();
    });

    it('should return original value', () => {
      expect(coerceToNull({})).toEqual({});
      expect(coerceToNull('str')).toBe('str');
      expect(coerceToNull(false)).toBe(false);
    });
  });

  describe('coerceToUndefined', () => {
    it('should return undefined', () => {
      expect(coerceToUndefined(undefined)).toBeUndefined();
      expect(coerceToUndefined(null)).toBeUndefined();
    });

    it('should return original value', () => {
      expect(coerceToUndefined({})).toEqual({});
      expect(coerceToUndefined('str')).toBe('str');
      expect(coerceToUndefined(false)).toBe(false);
    });
  });
});
