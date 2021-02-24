import { VersioningApi, get } from '..';
import { CONFIG_VALIDATION } from '../../constants/error-messages';

describe('regex', () => {
  const regex: VersioningApi = get(
    'regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(?:-(?<compatibility>.*))?$'
  );

  it('requires a valid configuration to be initialized', () => {
    expect(() => get('regex:not a regex')).toThrow();
  });

  describe('throws', () => {
    for (const re of [
      '^(?<major>\\d+)(',
      '^(?<major>\\d+)?(?<!y)x$',
      '^(?<major>\\d+)?(?<=y)x$',
    ]) {
      it(re, () => {
        expect(() => get(`regex:${re}`)).toThrow(CONFIG_VALIDATION);
      });
    }
  });

  describe('.parse()', () => {
    it('parses invalid matches as invalid', () => {
      expect(regex.isValid('1')).toBe(false);
      expect(regex.isValid('aardvark')).toBe(false);
      expect(regex.isValid('1.2a1-foo')).toBe(false);
    });
  });

  describe('.isCompatible', () => {
    it('returns true when the compatibilities are equal', () => {
      expect(regex.isCompatible('1.2.3', '2.3.4')).toBe(true);
      expect(regex.isCompatible('1.2.3a1', '2.3.4')).toBe(true);
      expect(regex.isCompatible('1.2.3', '2.3.4b1')).toBe(true);
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4-foobar')).toBe(true);
      expect(regex.isCompatible('1.2.3a1-foobar', '2.3.4-foobar')).toBe(true);
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4b1-foobar')).toBe(true);
    });

    it('returns false when the compatibilities are different', () => {
      expect(regex.isCompatible('1.2.3', '2.3.4-foobar')).toBe(false);
      expect(regex.isCompatible('1.2.3a1', '2.3.4-foobar')).toBe(false);
      expect(regex.isCompatible('1.2.3', '2.3.4b1-foobar')).toBe(false);
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4')).toBe(false);
      expect(regex.isCompatible('1.2.3a1-foobar', '2.3.4')).toBe(false);
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4b1')).toBe(false);
      expect(regex.isCompatible('1.2.3-foo', '2.3.4-bar')).toBe(false);
      expect(regex.isCompatible('1.2.3a1-foo', '2.3.4-bar')).toBe(false);
      expect(regex.isCompatible('1.2.3-foo', '2.3.4b1-bar')).toBe(false);
    });
  });

  describe('.isSingleVersion', () => {
    it('returns true when the version is valid', () => {
      expect(regex.isSingleVersion('1.2.3')).toBe(true);
      expect(regex.isSingleVersion('1.2.3a1')).toBe(true);
      expect(regex.isSingleVersion('1.2.3b2')).toBe(true);
      expect(regex.isSingleVersion('1.2.3-foo')).toBe(true);
      expect(regex.isSingleVersion('1.2.3b2-foo')).toBe(true);
      expect(regex.isSingleVersion('1.2.3b2-foo-bar')).toBe(true);
    });

    it('returns false when the version is not valid', () => {
      expect(regex.isSingleVersion('1')).toBe(false);
      expect(regex.isSingleVersion('1-foo')).toBe(false);
      expect(regex.isSingleVersion('1.2')).toBe(false);
      expect(regex.isSingleVersion('1.2-foo')).toBe(false);
      expect(regex.isSingleVersion('1.2.3.4.5.6.7')).toBe(false);
      expect(regex.isSingleVersion('1.2.aardvark')).toBe(false);
      expect(regex.isSingleVersion('1.2.aardvark-foo')).toBe(false);
      expect(regex.isSingleVersion('1.2a2.3')).toBe(false);
    });
  });

  describe('.isStable', () => {
    it('returns true when it is not a prerelease', () => {
      expect(regex.isStable('1.2.3')).toBe(true);
      expect(regex.isStable('1.2.3-foo')).toBe(true);
    });

    it('returns false when it is a prerelease', () => {
      expect(regex.isStable('1.2.3alpha')).toBe(false);
      expect(regex.isStable('1.2.3b3-foo')).toBe(false);
    });
  });

  describe('.isValid', () => {
    it('returns true when the version is valid', () => {
      expect(regex.isValid('1.2.3')).toBe(true);
      expect(regex.isValid('1.2.3a1')).toBe(true);
      expect(regex.isValid('1.2.3b2')).toBe(true);
      expect(regex.isValid('1.2.3-foo')).toBe(true);
      expect(regex.isValid('1.2.3b2-foo')).toBe(true);
      expect(regex.isValid('1.2.3b2-foo-bar')).toBe(true);
    });

    it('returns false when the version is not valid', () => {
      expect(regex.isValid('1')).toBe(false);
      expect(regex.isValid('1-foo')).toBe(false);
      expect(regex.isValid('1.2')).toBe(false);
      expect(regex.isValid('1.2-foo')).toBe(false);
      expect(regex.isValid('1.2.3.4.5.6.7')).toBe(false);
      expect(regex.isValid('1.2.aardvark')).toBe(false);
      expect(regex.isValid('1.2.aardvark-foo')).toBe(false);
      expect(regex.isValid('1.2a2.3')).toBe(false);
    });
  });

  describe('.isVersion', () => {
    it('returns true when the version is valid', () => {
      expect(regex.isVersion('1.2.3')).toBe(true);
      expect(regex.isVersion('1.2.3a1')).toBe(true);
      expect(regex.isVersion('1.2.3b2')).toBe(true);
      expect(regex.isVersion('1.2.3-foo')).toBe(true);
      expect(regex.isVersion('1.2.3b2-foo')).toBe(true);
      expect(regex.isVersion('1.2.3b2-foo-bar')).toBe(true);
    });

    it('returns false when the version is not valid', () => {
      expect(regex.isVersion('1')).toBe(false);
      expect(regex.isVersion('1-foo')).toBe(false);
      expect(regex.isVersion('1.2')).toBe(false);
      expect(regex.isVersion('1.2-foo')).toBe(false);
      expect(regex.isVersion('1.2.3.4.5.6.7')).toBe(false);
      expect(regex.isVersion('1.2.aardvark')).toBe(false);
      expect(regex.isVersion('1.2.aardvark-foo')).toBe(false);
      expect(regex.isVersion('1.2a2.3')).toBe(false);
    });
  });

  describe('.getMajor', () => {
    it('returns major segment of version', () => {
      expect(regex.getMajor('1.2.3')).toEqual(1);
      expect(regex.getMajor('1.2.3a1')).toEqual(1);
      expect(regex.getMajor('1.2.3a1-foo')).toEqual(1);
    });
  });

  describe('.getMinor', () => {
    it('returns minor segment of version', () => {
      expect(regex.getMinor('1.2.3')).toEqual(2);
      expect(regex.getMinor('1.2.3a1')).toEqual(2);
      expect(regex.getMinor('1.2.3a1-foo')).toEqual(2);
    });
  });

  describe('.getPatch', () => {
    it('returns patch segment of version', () => {
      expect(regex.getPatch('1.2.3')).toEqual(3);
      expect(regex.getPatch('1.2.3a1')).toEqual(3);
      expect(regex.getPatch('1.2.3a1-foo')).toEqual(3);
    });
  });

  describe('.equals', () => {
    it('returns true when versions are exactly equal', () => {
      expect(regex.equals('1.2.3', '1.2.3')).toBe(true);
      expect(regex.equals('1.2.3a1', '1.2.3a1')).toBe(true);
      expect(regex.equals('1.2.3a1-foo', '1.2.3a1-foo')).toBe(true);
    });

    it('retuns true when only compatibility differs', () => {
      expect(regex.equals('1.2.3', '1.2.3-bar')).toBe(true);
      expect(regex.equals('1.2.3a1', '1.2.3a1-bar')).toBe(true);
      expect(regex.equals('1.2.3a1-foo', '1.2.3a1-bar')).toBe(true);
    });

    it('returns flase when versions are otherwise different', () => {
      expect(regex.equals('1.2.3', '1.2.4')).toBe(false);
      expect(regex.equals('1.2.3', '1.3.3')).toBe(false);
      expect(regex.equals('1.2.3', '2.2.3')).toBe(false);
      expect(regex.equals('1.2.3', '1.2.3a1')).toBe(false);
      expect(regex.equals('1.2.3a1', '1.2.3a2')).toBe(false);
      expect(regex.equals('1.2.3', '1.2.4-foo')).toBe(false);
      expect(regex.equals('1.2.3', '1.3.3-foo')).toBe(false);
      expect(regex.equals('1.2.3', '2.2.3-foo')).toBe(false);
      expect(regex.equals('1.2.3', '1.2.3a1-foo')).toBe(false);
      expect(regex.equals('1.2.3a1', '1.2.3a2-foo')).toBe(false);
    });
  });

  describe('.isGreaterThan', () => {
    it('returns true when version is greater than another', () => {
      expect(regex.isGreaterThan('2.0.0', '1.0.0')).toBe(true);
      expect(regex.isGreaterThan('2.2.0', '2.1.0')).toBe(true);
      expect(regex.isGreaterThan('2.2.1', '2.2.0')).toBe(true);
      expect(regex.isGreaterThan('3.0.0a2', '3.0.0a1')).toBe(true);
      expect(regex.isGreaterThan('3.0.0b1', '3.0.0a2')).toBe(true);
      expect(regex.isGreaterThan('3.0.0', '3.0.0b2')).toBe(true);
    });

    it('ignores compatibility differences', () => {
      expect(regex.isGreaterThan('2.0.0', '1.0.0-foo')).toBe(true);
      expect(regex.isGreaterThan('2.2.0', '2.1.0-foo')).toBe(true);
      expect(regex.isGreaterThan('2.2.1', '2.2.0-foo')).toBe(true);
      expect(regex.isGreaterThan('3.0.0a2', '3.0.0a1-foo')).toBe(true);
      expect(regex.isGreaterThan('3.0.0b1', '3.0.0a2-foo')).toBe(true);
    });

    it('returns false when version is lower than another', () => {
      expect(regex.isGreaterThan('1.0.0', '2.0.0')).toBe(false);
      expect(regex.isGreaterThan('2.1.0', '2.2.0')).toBe(false);
      expect(regex.isGreaterThan('2.2.1', '2.2.2')).toBe(false);
      expect(regex.isGreaterThan('3.0.0a1', '3.0.0a2')).toBe(false);
      expect(regex.isGreaterThan('3.0.0a2', '3.0.0b1')).toBe(false);
      expect(regex.isGreaterThan('3.0.0b2', '3.0.0')).toBe(false);
    });

    it('returns false when versions are equal', () => {
      expect(regex.isGreaterThan('1.0.0', '1.0.0')).toBe(false);
      expect(regex.isGreaterThan('2.1.0', '2.1.0')).toBe(false);
      expect(regex.isGreaterThan('2.2.0', '2.2.0')).toBe(false);
      expect(regex.isGreaterThan('3.0.0a1', '3.0.0a1')).toBe(false);
      expect(regex.isGreaterThan('3.0.0b2', '3.0.0b2')).toBe(false);
      expect(regex.isGreaterThan('1.0.0', '1.0.0-foo')).toBe(false);
      expect(regex.isGreaterThan('2.1.0', '2.1.0-foo')).toBe(false);
      expect(regex.isGreaterThan('2.2.0', '2.2.0-foo')).toBe(false);
      expect(regex.isGreaterThan('3.0.0a1', '3.0.0a1-foo')).toBe(false);
      expect(regex.isGreaterThan('3.0.0b2', '3.0.0b2-foo')).toBe(false);
    });
  });

  describe('.isLessThanRange', () => {
    it('returns true when version less than range', () => {
      expect(regex.isLessThanRange('1.2.2', '1.2.3')).toBe(true);
      expect(regex.isLessThanRange('1.2.2', '1.2.3-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2', '1.2.3a1')).toBe(true);
      expect(regex.isLessThanRange('1.2.2', '1.2.3a1-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3')).toBe(true);
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3a1')).toBe(true);
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3a1-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3a1')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3a1-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3-bar')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3a1')).toBe(true);
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3a1-bar')).toBe(true);
    });

    it('returns false when version satisfies range', () => {
      expect(regex.isLessThanRange('1.2.2', '1.2.2')).toBe(false);
      expect(regex.isLessThanRange('1.2.2', '1.2.2-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.2')).toBe(false);
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.2-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.2a1', '1.2.2a1')).toBe(false);
      expect(regex.isLessThanRange('1.2.2a1', '1.2.2a1-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.2a1')).toBe(false);
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.2a1-bar')).toBe(false);
    });

    it('returns false when version greater than range', () => {
      expect(regex.isLessThanRange('1.2.4', '1.2.3')).toBe(false);
      expect(regex.isLessThanRange('1.2.4', '1.2.3-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4', '1.2.3a1')).toBe(false);
      expect(regex.isLessThanRange('1.2.4', '1.2.3a1-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3')).toBe(false);
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3a1')).toBe(false);
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3a1-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3a1')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3a1-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3-bar')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3a1')).toBe(false);
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3a1-bar')).toBe(false);
    });
  });

  describe('.getSatisfyingVersion', () => {
    it('returns greatest version that matches range', () => {
      expect(
        regex.getSatisfyingVersion(
          ['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo'],
          '2.1.6'
        )
      ).toEqual('2.1.6');
      expect(
        regex.getSatisfyingVersion(
          ['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo'],
          '2.1.6-foo'
        )
      ).toEqual('2.1.6');
      expect(
        regex.getSatisfyingVersion(['2.1.5-foo', '2.1.6'], '2.1.6-foo')
      ).toEqual('2.1.6');
    });

    it('returns null if version that matches is absent', () => {
      expect(
        regex.getSatisfyingVersion(['1.2.3', '1.2.4'], '3.5.0')
      ).toBeNull();
    });
  });

  describe('.minSatisfyingVersion', () => {
    it('returns least version that matches range', () => {
      expect(
        regex.minSatisfyingVersion(
          ['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo'],
          '2.1.6'
        )
      ).toEqual('2.1.6');
      expect(
        regex.minSatisfyingVersion(
          ['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo'],
          '2.1.6-foo'
        )
      ).toEqual('2.1.6');
      expect(
        regex.minSatisfyingVersion(['2.1.5', '2.1.6-foo'], '2.1.5-foo')
      ).toEqual('2.1.5');
    });

    it('returns null if version that matches is absent', () => {
      expect(
        regex.minSatisfyingVersion(['1.2.3', '1.2.4'], '3.5.0')
      ).toBeNull();
    });
  });

  describe('.getNewValue', () => {
    it('returns newVersion', () => {
      expect(
        regex.getNewValue({
          currentValue: null,
          rangeStrategy: null,
          currentVersion: null,
          newVersion: '1.2.3',
        })
      ).toBe('1.2.3');
    });
  });

  describe('.sortVersions', () => {
    it('sorts versions in an ascending order', () => {
      expect(
        ['1.2.3a1', '2.0.1', '1.3.4', '1.2.3'].sort(
          regex.sortVersions.bind(regex)
        )
      ).toEqual(['1.2.3a1', '1.2.3', '1.3.4', '2.0.1']);
    });
  });

  describe('.matches', () => {
    it('returns true when version match range', () => {
      expect(regex.matches('1.2.2', '1.2.2')).toBe(true);
      expect(regex.matches('1.2.2', '1.2.2-bar')).toBe(true);
      expect(regex.matches('1.2.2-foo', '1.2.2')).toBe(true);
      expect(regex.matches('1.2.2-foo', '1.2.2-bar')).toBe(true);
      expect(regex.matches('1.2.2a1', '1.2.2a1')).toBe(true);
      expect(regex.matches('1.2.2a1', '1.2.2a1-bar')).toBe(true);
      expect(regex.matches('1.2.2a1-foo', '1.2.2a1')).toBe(true);
      expect(regex.matches('1.2.2a1-foo', '1.2.2a1-bar')).toBe(true);
    });

    it('returns false when version not match range', () => {
      expect(regex.matches('1.2.2', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.2', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.2', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.2', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.2-foo', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.2-foo', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.2-foo', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.2-foo', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.2a1', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.2a1', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.2a1', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.2a1', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.2a1-foo', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.2a1-foo', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.2a1-foo', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.2a1-foo', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.4', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.4', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.4', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.4', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.4-foo', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.4-foo', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.4-foo', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.4-foo', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.4a1', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.4a1', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.4a1', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.4a1', '1.2.3a1-bar')).toBe(false);
      expect(regex.matches('1.2.4a1-foo', '1.2.3')).toBe(false);
      expect(regex.matches('1.2.4a1-foo', '1.2.3-bar')).toBe(false);
      expect(regex.matches('1.2.4a1-foo', '1.2.3a1')).toBe(false);
      expect(regex.matches('1.2.4a1-foo', '1.2.3a1-bar')).toBe(false);
    });
  });
});
