import {
  anyMatchRegexOrGlobList,
  getRegexPredicate,
  matchRegexOrGlob,
  matchRegexOrGlobList,
} from './string-match';

describe('util/string-match', () => {
  describe('matchRegexOrGlobList()', () => {
    it('returns false if empty patterns', () => {
      expect(matchRegexOrGlobList('test', [])).toBeFalse();
    });

    it('returns false if no match', () => {
      expect(matchRegexOrGlobList('test', ['/test2/'])).toBeFalse();
    });

    it('returns true if star', () => {
      expect(matchRegexOrGlobList('&&&', ['*'])).toBeTrue();
    });

    it('returns true if any match', () => {
      expect(matchRegexOrGlobList('test', ['test', '/test2/'])).toBeTrue();
    });

    it('returns true if one match with negative patterns', () => {
      expect(matchRegexOrGlobList('test', ['!/test2/'])).toBeTrue();
    });

    it('returns true if every match with negative patterns', () => {
      expect(matchRegexOrGlobList('test', ['!/test2/', '!/test3/'])).toBeTrue();
    });

    it('returns true if matching positive and negative patterns', () => {
      expect(matchRegexOrGlobList('test', ['test', '!/test3/'])).toBeTrue();
    });

    it('returns true case insensitive for glob', () => {
      expect(matchRegexOrGlobList('TEST', ['t*'])).toBeTrue();
    });

    it('returns true if matching every negative pattern (regex)', () => {
      expect(
        matchRegexOrGlobList('test', ['test', '!/test3/', '!/test4/']),
      ).toBeTrue();
    });

    it('returns false if not matching every negative pattern (regex)', () => {
      expect(matchRegexOrGlobList('test', ['!/test3/', '!/test/'])).toBeFalse();
    });

    it('returns true if matching every negative pattern (glob)', () => {
      expect(
        matchRegexOrGlobList('test', ['test', '!test3', '!test4']),
      ).toBeTrue();
    });

    it('returns false if not matching every negative pattern (glob)', () => {
      expect(matchRegexOrGlobList('test', ['!test3', '!te*'])).toBeFalse();
    });
  });

  describe('anyMatchRegexOrGlobList()', () => {
    it('returns false if empty patterns', () => {
      expect(anyMatchRegexOrGlobList(['test'], [])).toBeFalse();
    });

    it('returns false if empty inputs', () => {
      expect(anyMatchRegexOrGlobList([], ['/test2/'])).toBeFalse();
    });

    it('returns true if both empty', () => {
      expect(anyMatchRegexOrGlobList([], [])).toBeFalse();
    });

    it('returns true if any match with positive', () => {
      expect(anyMatchRegexOrGlobList(['a', 'b'], ['b'])).toBeTrue();
    });

    it('returns true if any match with negative', () => {
      expect(anyMatchRegexOrGlobList(['a', 'b'], ['!b'])).toBeTrue();
    });
  });

  describe('getRegexPredicate()', () => {
    it('allows valid regex pattern', () => {
      expect(getRegexPredicate('/hello/')).not.toBeNull();
    });

    it('invalidates invalid regex pattern', () => {
      expect(getRegexPredicate('/^test\\d+$/m')).toBeNull();
    });

    it('allows the i flag in regex pattern', () => {
      expect(getRegexPredicate('/^test\\d+$/i')).not.toBeNull();
    });

    it('allows negative regex pattern', () => {
      expect(getRegexPredicate('!/^test\\d+$/i')).not.toBeNull();
    });

    it('does not allow non-regex input', () => {
      expect(getRegexPredicate('hello')).toBeNull();
    });
  });

  describe('matchRegexOrGlob()', () => {
    it('returns true if positive regex pattern matched', () => {
      expect(matchRegexOrGlob('test', '/test/')).toBeTrue();
    });

    it('returns true if negative regex is not matched', () => {
      expect(matchRegexOrGlob('test', '!/test3/')).toBeTrue();
    });

    it('returns false if negative pattern is matched', () => {
      expect(matchRegexOrGlob('test', '!/te/')).toBeFalse();
    });
  });
});
