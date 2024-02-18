import {
  anyMatchRegexOrMinimatch,
  configRegexPredicate,
  matchRegexOrMinimatch,
} from './string-match';

describe('util/string-match', () => {
  describe('anyMatchRegexOrMinimatch()', () => {
    it('returns false if empty patterns', () => {
      expect(anyMatchRegexOrMinimatch('test', [])).toBeFalse();
    });

    it('returns false if no match', () => {
      expect(anyMatchRegexOrMinimatch('test', ['/test2/'])).toBeFalse();
    });

    it('returns true if any match', () => {
      expect(anyMatchRegexOrMinimatch('test', ['test', '/test2/'])).toBeTrue();
    });

    it('returns true if one match with negative patterns', () => {
      expect(anyMatchRegexOrMinimatch('test', ['!/test2/'])).toBeTrue();
    });

    it('returns true if every match with negative patterns', () => {
      expect(
        anyMatchRegexOrMinimatch('test', ['!/test2/', '!/test3/']),
      ).toBeTrue();
    });

    it('returns true if matching positive and negative patterns', () => {
      expect(anyMatchRegexOrMinimatch('test', ['test', '!/test3/'])).toBeTrue();
    });
  });

  describe('configRegexPredicate', () => {
    it('allows valid regex pattern', () => {
      expect(configRegexPredicate('/hello/')).not.toBeNull();
    });

    it('invalidates invalid regex pattern', () => {
      expect(configRegexPredicate('/^test\\d+$/m')).toBeNull();
    });

    it('allows the i flag in regex pattern', () => {
      expect(configRegexPredicate('/^test\\d+$/i')).not.toBeNull();
    });

    it('allows negative regex pattern', () => {
      expect(configRegexPredicate('!/^test\\d+$/i')).not.toBeNull();
    });

    it('does not allow non-regex input', () => {
      expect(configRegexPredicate('hello')).toBeNull();
    });
  });

  describe('matchRegexOrMinimatch()', () => {
    it('returns true if positive regex pattern matched', () => {
      expect(matchRegexOrMinimatch('test', '/test/')).toBeTrue();
    });

    it('returns true if negative regex is not matched', () => {
      expect(matchRegexOrMinimatch('test', '!/test3/')).toBeTrue();
    });

    it('returns false if negative pattern is matched', () => {
      expect(matchRegexOrMinimatch('test', '!/te/')).toBeFalse();
    });
  });
});
