const semver = require('../../lib/versioning/hex');

describe('lib/versoning/hex', () => {
  describe('semver.matches()', () => {
    it('handles tilde greater than', () => {
      expect(semver.matches('4.2.0', '~> 4.0')).toBe(true);
      expect(semver.matches('2.1.0', '~> 2.0.0')).toBe(false);
      expect(semver.matches('2.0.0', '>= 2.0.0 and < 2.1.0')).toBe(true);
      expect(semver.matches('2.1.0', '== 2.0.0 or < 2.1.0')).toBe(false);
    });
  });
});
