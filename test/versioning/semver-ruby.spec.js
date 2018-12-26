const semverRuby = require('../../lib/versioning/semver-ruby');

describe('semverRuby', () => {
  describe('.getMajor', () => {
    it('returns major segment of version', () => {
      expect(semverRuby.getMajor('1')).toEqual(1);
      expect(semverRuby.getMajor('1.2')).toEqual(1);
      expect(semverRuby.getMajor('1.2.0')).toEqual(1);
      expect(semverRuby.getMajor('1.2.0.alpha.4')).toEqual(1);
    });
  });

  describe('.getMinor', () => {
    it('returns minor segment of version when it present', () => {
      expect(semverRuby.getMinor('1.2')).toEqual(2);
      expect(semverRuby.getMinor('1.2.0')).toEqual(2);
      expect(semverRuby.getMinor('1.2.0.alpha.4')).toEqual(2);
    });

    it('.returns null when minor segment absent', () => {
      expect(semverRuby.getMinor('1')).toEqual(null);
    });
  });

  describe('.getPatch', () => {
    it('returns patch segment of version when it present', () => {
      expect(semverRuby.getPatch('1.2.2')).toEqual(2);
      expect(semverRuby.getPatch('1.2.1.alpha.4')).toEqual(1);
    });

    it('returns null when patch segment absent', () => {
      expect(semverRuby.getPatch('1')).toEqual(null);
      expect(semverRuby.getPatch('1.2')).toEqual(null);
    });
  });
});
