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

    it('returns null when minor segment absent', () => {
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

  describe('.isVersion', () => {
    it('returns true when version is valid', () => {
      expect(semverRuby.isVersion('1')).toBeTruthy();
      expect(semverRuby.isVersion('1.1')).toBeTruthy();
      expect(semverRuby.isVersion('1.1.2')).toBeTruthy();
      expect(semverRuby.isVersion('1.1.2.3')).toBeTruthy();
      expect(semverRuby.isVersion('1.1.2-4')).toBeTruthy();
      expect(semverRuby.isVersion('1.1.2.pre.4')).toBeTruthy();
    });

    it('returns false when version is invalid', () => {
      expect(semverRuby.isVersion()).toBeFalsy();
      expect(semverRuby.isVersion('')).toBeFalsy();
      expect(semverRuby.isVersion(null)).toBeFalsy();
      expect(semverRuby.isVersion('tottally-not-a-version')).toBeFalsy();
    });
  });

  describe('.isGreaterThan', () => {
    it('returns true when version is greater than another', () => {
      expect(semverRuby.isGreaterThan('2', '1')).toBeTruthy();
      expect(semverRuby.isGreaterThan('2.2', '2.1')).toBeTruthy();
      expect(semverRuby.isGreaterThan('2.2.1', '2.2.0')).toBeTruthy();
      expect(semverRuby.isGreaterThan('3.0.0.rc2', '3.0.0.rc1')).toBeTruthy();
      expect(semverRuby.isGreaterThan('3.0.0-rc.2', '3.0.0-rc.1')).toBeTruthy();
      expect(semverRuby.isGreaterThan('3.0.0.rc1', '3.0.0.beta')).toBeTruthy();
      expect(semverRuby.isGreaterThan('3.0.0-rc.1', '3.0.0-beta')).toBeTruthy();
      expect(
        semverRuby.isGreaterThan('3.0.0.beta', '3.0.0.alpha')
      ).toBeTruthy();
      expect(
        semverRuby.isGreaterThan('3.0.0-beta', '3.0.0-alpha')
      ).toBeTruthy();
      expect(semverRuby.isGreaterThan('5.0.1.rc1', '5.0.1.beta1')).toBeTruthy();
      expect(
        semverRuby.isGreaterThan('5.0.1-rc.1', '5.0.1-beta.1')
      ).toBeTruthy();
    });

    it('returns false when version is lower than another', () => {
      expect(semverRuby.isGreaterThan('1', '2')).toBeFalsy();
      expect(semverRuby.isGreaterThan('2.1', '2.2')).toBeFalsy();
      expect(semverRuby.isGreaterThan('2.2.0', '2.2.1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0.rc1', '3.0.0.rc2')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0-rc.1', '3.0.0-rc.2')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0.beta', '3.0.0.rc1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0-beta', '3.0.0-rc.1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0.alpha', '3.0.0.beta')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0-alpha', '3.0.0-beta')).toBeFalsy();
      expect(semverRuby.isGreaterThan('5.0.1.beta1', '5.0.1.rc1')).toBeFalsy();
      expect(
        semverRuby.isGreaterThan('5.0.1-beta.1', '5.0.1-rc.1')
      ).toBeFalsy();
    });

    it('returns false when versions are equal', () => {
      expect(semverRuby.isGreaterThan('1', '1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('2.1', '2.1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('2.2.0', '2.2.0')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0.rc1', '3.0.0.rc1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0-rc.1', '3.0.0-rc.1')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0.beta', '3.0.0.beta')).toBeFalsy();
      expect(semverRuby.isGreaterThan('3.0.0-beta', '3.0.0-beta')).toBeFalsy();
      expect(
        semverRuby.isGreaterThan('3.0.0.alpha', '3.0.0.alpha')
      ).toBeFalsy();
      expect(
        semverRuby.isGreaterThan('3.0.0-alpha', '3.0.0-alpha')
      ).toBeFalsy();
      expect(
        semverRuby.isGreaterThan('5.0.1.beta1', '5.0.1.beta1')
      ).toBeFalsy();
      expect(
        semverRuby.isGreaterThan('5.0.1-beta.1', '5.0.1-beta.1')
      ).toBeFalsy();
    });
  });

  describe('.isStable', () => {
    it('returns true when version is stable', () => {
      expect(semverRuby.isStable('1')).toBeTruthy();
      expect(semverRuby.isStable('1.2')).toBeTruthy();
      expect(semverRuby.isStable('1.2.3')).toBeTruthy();
    });

    it('returns false when version is prerelease', () => {
      expect(semverRuby.isStable('1.2.0-alpha')).toBeFalsy();
      expect(semverRuby.isStable('1.2.0.alpha')).toBeFalsy();
      expect(semverRuby.isStable('1.2.0.alpha1')).toBeFalsy();
      expect(semverRuby.isStable('1.2.0-alpha.1')).toBeFalsy();
    });

    it('returns false when version is invalid', () => {
      expect(semverRuby.isStable()).toBeFalsy();
      expect(semverRuby.isStable('')).toBeFalsy();
      expect(semverRuby.isStable(null)).toBeFalsy();
      expect(semverRuby.isStable('tottally-not-a-version')).toBeFalsy();
    });
  });

  describe('.equals', () => {
    it('returns true when versions are equal', () => {
      expect(semverRuby.equals('1.0.0', '1')).toBe(true);
      expect(semverRuby.equals('1.2.0', '1.2')).toBe(true);
      expect(semverRuby.equals('1.2.0', '1.2.0')).toBe(true);
      expect(semverRuby.equals('1.0.0.rc1', '1.0.0.rc1')).toBe(true);
    });

    it('returns false when versions are different', () => {
      expect(semverRuby.equals('1.2.0', '2')).toBe(false);
      expect(semverRuby.equals('1.2.0', '1.1')).toBe(false);
      expect(semverRuby.equals('1.2.0', '1.2.1')).toBe(false);
      expect(semverRuby.equals('1.0.0.rc1', '1.0.0.rc2')).toBe(false);
    });
  });
});
