import { configRegexPredicate, isUUID } from './string-match';

describe('util/string-match', () => {
  describe('isUUID', () => {
    it('proper checks valid and invalid UUID strings', () => {
      expect(isUUID('{90b6646d-1724-4a64-9fd9-539515fe94e9}')).toBe(true);
      expect(isUUID('{90B6646D-1724-4A64-9FD9-539515FE94E9}')).toBe(true);
      expect(isUUID('not-a-uuid')).toBe(false);
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
});
