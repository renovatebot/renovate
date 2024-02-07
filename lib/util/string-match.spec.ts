import { configRegexPredicate } from './string-match';

describe('util/string-match', () => {
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
