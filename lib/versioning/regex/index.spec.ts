import { VersioningApi, get } from '..';
import { CONFIG_VALIDATION } from '../../constants/error-messages';

describe('versioning/regex/index', () => {
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
      expect(regex.isValid('1')).toBeFalse();
      expect(regex.isValid('aardvark')).toBeFalse();
      expect(regex.isValid('1.2a1-foo')).toBeFalse();
    });
  });

  describe('.isCompatible', () => {
    it('returns true when the compatibilities are equal', () => {
      expect(regex.isCompatible('1.2.3', '2.3.4')).toBeTrue();
      expect(regex.isCompatible('1.2.3a1', '2.3.4')).toBeTrue();
      expect(regex.isCompatible('1.2.3', '2.3.4b1')).toBeTrue();
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4-foobar')).toBeTrue();
      expect(regex.isCompatible('1.2.3a1-foobar', '2.3.4-foobar')).toBeTrue();
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4b1-foobar')).toBeTrue();
    });

    it('returns false when the compatibilities are different', () => {
      expect(regex.isCompatible('1.2.3', '2.3.4-foobar')).toBeFalse();
      expect(regex.isCompatible('1.2.3a1', '2.3.4-foobar')).toBeFalse();
      expect(regex.isCompatible('1.2.3', '2.3.4b1-foobar')).toBeFalse();
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4')).toBeFalse();
      expect(regex.isCompatible('1.2.3a1-foobar', '2.3.4')).toBeFalse();
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4b1')).toBeFalse();
      expect(regex.isCompatible('1.2.3-foo', '2.3.4-bar')).toBeFalse();
      expect(regex.isCompatible('1.2.3a1-foo', '2.3.4-bar')).toBeFalse();
      expect(regex.isCompatible('1.2.3-foo', '2.3.4b1-bar')).toBeFalse();
    });
  });

  describe('.isSingleVersion', () => {
    it('returns true when the version is valid', () => {
      expect(regex.isSingleVersion('1.2.3')).toBeTrue();
      expect(regex.isSingleVersion('1.2.3a1')).toBeTrue();
      expect(regex.isSingleVersion('1.2.3b2')).toBeTrue();
      expect(regex.isSingleVersion('1.2.3-foo')).toBeTrue();
      expect(regex.isSingleVersion('1.2.3b2-foo')).toBeTrue();
      expect(regex.isSingleVersion('1.2.3b2-foo-bar')).toBeTrue();
    });

    it('returns false when the version is not valid', () => {
      expect(regex.isSingleVersion('1')).toBeFalse();
      expect(regex.isSingleVersion('1-foo')).toBeFalse();
      expect(regex.isSingleVersion('1.2')).toBeFalse();
      expect(regex.isSingleVersion('1.2-foo')).toBeFalse();
      expect(regex.isSingleVersion('1.2.3.4.5.6.7')).toBeFalse();
      expect(regex.isSingleVersion('1.2.aardvark')).toBeFalse();
      expect(regex.isSingleVersion('1.2.aardvark-foo')).toBeFalse();
      expect(regex.isSingleVersion('1.2a2.3')).toBeFalse();
    });
  });

  describe('.isStable', () => {
    it('returns true when it is not a prerelease', () => {
      expect(regex.isStable('1.2.3')).toBeTrue();
      expect(regex.isStable('1.2.3-foo')).toBeTrue();
    });

    it('returns false when it is a prerelease', () => {
      expect(regex.isStable('1.2.3alpha')).toBeFalse();
      expect(regex.isStable('1.2.3b3-foo')).toBeFalse();
    });
  });

  describe('.isValid', () => {
    it('returns true when the version is valid', () => {
      expect(regex.isValid('1.2.3')).toBeTrue();
      expect(regex.isValid('1.2.3a1')).toBeTrue();
      expect(regex.isValid('1.2.3b2')).toBeTrue();
      expect(regex.isValid('1.2.3-foo')).toBeTrue();
      expect(regex.isValid('1.2.3b2-foo')).toBeTrue();
      expect(regex.isValid('1.2.3b2-foo-bar')).toBeTrue();
    });

    it('returns false when the version is not valid', () => {
      expect(regex.isValid('1')).toBeFalse();
      expect(regex.isValid('1-foo')).toBeFalse();
      expect(regex.isValid('1.2')).toBeFalse();
      expect(regex.isValid('1.2-foo')).toBeFalse();
      expect(regex.isValid('1.2.3.4.5.6.7')).toBeFalse();
      expect(regex.isValid('1.2.aardvark')).toBeFalse();
      expect(regex.isValid('1.2.aardvark-foo')).toBeFalse();
      expect(regex.isValid('1.2a2.3')).toBeFalse();
    });
  });

  describe('.isVersion', () => {
    it('returns true when the version is valid', () => {
      expect(regex.isVersion('1.2.3')).toBeTrue();
      expect(regex.isVersion('1.2.3a1')).toBeTrue();
      expect(regex.isVersion('1.2.3b2')).toBeTrue();
      expect(regex.isVersion('1.2.3-foo')).toBeTrue();
      expect(regex.isVersion('1.2.3b2-foo')).toBeTrue();
      expect(regex.isVersion('1.2.3b2-foo-bar')).toBeTrue();
    });

    it('returns false when the version is not valid', () => {
      expect(regex.isVersion('1')).toBeFalse();
      expect(regex.isVersion('1-foo')).toBeFalse();
      expect(regex.isVersion('1.2')).toBeFalse();
      expect(regex.isVersion('1.2-foo')).toBeFalse();
      expect(regex.isVersion('1.2.3.4.5.6.7')).toBeFalse();
      expect(regex.isVersion('1.2.aardvark')).toBeFalse();
      expect(regex.isVersion('1.2.aardvark-foo')).toBeFalse();
      expect(regex.isVersion('1.2a2.3')).toBeFalse();
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
      expect(regex.equals('1.2.3', '1.2.3')).toBeTrue();
      expect(regex.equals('1.2.3a1', '1.2.3a1')).toBeTrue();
      expect(regex.equals('1.2.3a1-foo', '1.2.3a1-foo')).toBeTrue();
    });

    it('retuns true when only compatibility differs', () => {
      expect(regex.equals('1.2.3', '1.2.3-bar')).toBeTrue();
      expect(regex.equals('1.2.3a1', '1.2.3a1-bar')).toBeTrue();
      expect(regex.equals('1.2.3a1-foo', '1.2.3a1-bar')).toBeTrue();
    });

    it('returns flase when versions are otherwise different', () => {
      expect(regex.equals('1.2.3', '1.2.4')).toBeFalse();
      expect(regex.equals('1.2.3', '1.3.3')).toBeFalse();
      expect(regex.equals('1.2.3', '2.2.3')).toBeFalse();
      expect(regex.equals('1.2.3', '1.2.3a1')).toBeFalse();
      expect(regex.equals('1.2.3a1', '1.2.3a2')).toBeFalse();
      expect(regex.equals('1.2.3', '1.2.4-foo')).toBeFalse();
      expect(regex.equals('1.2.3', '1.3.3-foo')).toBeFalse();
      expect(regex.equals('1.2.3', '2.2.3-foo')).toBeFalse();
      expect(regex.equals('1.2.3', '1.2.3a1-foo')).toBeFalse();
      expect(regex.equals('1.2.3a1', '1.2.3a2-foo')).toBeFalse();
    });
  });

  describe('.isGreaterThan', () => {
    it('returns true when version is greater than another', () => {
      expect(regex.isGreaterThan('2.0.0', '1.0.0')).toBeTrue();
      expect(regex.isGreaterThan('2.2.0', '2.1.0')).toBeTrue();
      expect(regex.isGreaterThan('2.2.1', '2.2.0')).toBeTrue();
      expect(regex.isGreaterThan('3.0.0a2', '3.0.0a1')).toBeTrue();
      expect(regex.isGreaterThan('3.0.0b1', '3.0.0a2')).toBeTrue();
      expect(regex.isGreaterThan('3.0.0', '3.0.0b2')).toBeTrue();
    });

    it('ignores compatibility differences', () => {
      expect(regex.isGreaterThan('2.0.0', '1.0.0-foo')).toBeTrue();
      expect(regex.isGreaterThan('2.2.0', '2.1.0-foo')).toBeTrue();
      expect(regex.isGreaterThan('2.2.1', '2.2.0-foo')).toBeTrue();
      expect(regex.isGreaterThan('3.0.0a2', '3.0.0a1-foo')).toBeTrue();
      expect(regex.isGreaterThan('3.0.0b1', '3.0.0a2-foo')).toBeTrue();
    });

    it('returns false when version is lower than another', () => {
      expect(regex.isGreaterThan('1.0.0', '2.0.0')).toBeFalse();
      expect(regex.isGreaterThan('2.1.0', '2.2.0')).toBeFalse();
      expect(regex.isGreaterThan('2.2.1', '2.2.2')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0a1', '3.0.0a2')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0a2', '3.0.0b1')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0b2', '3.0.0')).toBeFalse();
    });

    it('returns false when versions are equal', () => {
      expect(regex.isGreaterThan('1.0.0', '1.0.0')).toBeFalse();
      expect(regex.isGreaterThan('2.1.0', '2.1.0')).toBeFalse();
      expect(regex.isGreaterThan('2.2.0', '2.2.0')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0a1', '3.0.0a1')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0b2', '3.0.0b2')).toBeFalse();
      expect(regex.isGreaterThan('1.0.0', '1.0.0-foo')).toBeFalse();
      expect(regex.isGreaterThan('2.1.0', '2.1.0-foo')).toBeFalse();
      expect(regex.isGreaterThan('2.2.0', '2.2.0-foo')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0a1', '3.0.0a1-foo')).toBeFalse();
      expect(regex.isGreaterThan('3.0.0b2', '3.0.0b2-foo')).toBeFalse();
    });
  });

  describe('.isLessThanRange', () => {
    it('returns true when version less than range', () => {
      expect(regex.isLessThanRange('1.2.2', '1.2.3')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2', '1.2.3-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2', '1.2.3a1')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2', '1.2.3a1-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3a1')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.3a1-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3a1')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1', '1.2.3a1-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3-bar')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3a1')).toBeTrue();
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.3a1-bar')).toBeTrue();
    });

    it('returns false when version satisfies range', () => {
      expect(regex.isLessThanRange('1.2.2', '1.2.2')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2', '1.2.2-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.2')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2-foo', '1.2.2-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2a1', '1.2.2a1')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2a1', '1.2.2a1-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.2a1')).toBeFalse();
      expect(regex.isLessThanRange('1.2.2a1-foo', '1.2.2a1-bar')).toBeFalse();
    });

    it('returns false when version greater than range', () => {
      expect(regex.isLessThanRange('1.2.4', '1.2.3')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4', '1.2.3-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4', '1.2.3a1')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4', '1.2.3a1-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3a1')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4-foo', '1.2.3a1-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3a1')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1', '1.2.3a1-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3-bar')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3a1')).toBeFalse();
      expect(regex.isLessThanRange('1.2.4a1-foo', '1.2.3a1-bar')).toBeFalse();
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
      expect(regex.matches('1.2.2', '1.2.2')).toBeTrue();
      expect(regex.matches('1.2.2', '1.2.2-bar')).toBeTrue();
      expect(regex.matches('1.2.2-foo', '1.2.2')).toBeTrue();
      expect(regex.matches('1.2.2-foo', '1.2.2-bar')).toBeTrue();
      expect(regex.matches('1.2.2a1', '1.2.2a1')).toBeTrue();
      expect(regex.matches('1.2.2a1', '1.2.2a1-bar')).toBeTrue();
      expect(regex.matches('1.2.2a1-foo', '1.2.2a1')).toBeTrue();
      expect(regex.matches('1.2.2a1-foo', '1.2.2a1-bar')).toBeTrue();
    });

    it('returns false when version not match range', () => {
      expect(regex.matches('1.2.2', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.2', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.2', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.2', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.2-foo', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.2-foo', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.2-foo', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.2-foo', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.2a1', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.2a1', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.2a1', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.2a1', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.2a1-foo', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.2a1-foo', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.2a1-foo', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.2a1-foo', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.4', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.4', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.4', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.4', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.4-foo', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.4-foo', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.4-foo', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.4-foo', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.4a1', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.4a1', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.4a1', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.4a1', '1.2.3a1-bar')).toBeFalse();
      expect(regex.matches('1.2.4a1-foo', '1.2.3')).toBeFalse();
      expect(regex.matches('1.2.4a1-foo', '1.2.3-bar')).toBeFalse();
      expect(regex.matches('1.2.4a1-foo', '1.2.3a1')).toBeFalse();
      expect(regex.matches('1.2.4a1-foo', '1.2.3a1-bar')).toBeFalse();
    });
  });

  describe('Supported 4th number as build', () => {
    it('supports Bitnami docker versioning', () => {
      const re = get(
        'regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(:?-(?<compatibility>.*-r)(?<build>\\d+))?$'
      );

      expect(re.isValid('12.7.0-debian-10-r69')).toBeTrue();
      expect(re.isValid('12.7.0-debian-10-r100')).toBeTrue();

      expect(
        re.isCompatible('12.7.0-debian-10-r69', '12.7.0-debian-10-r100')
      ).toBeTrue();

      expect(
        re.isGreaterThan('12.7.0-debian-10-r69', '12.7.0-debian-10-r100')
      ).toBeFalse();
      expect(
        re.isGreaterThan('12.7.0-debian-10-r169', '12.7.0-debian-10-r100')
      ).toBeTrue();

      expect(re.matches('12.7.0-debian-9-r69', '12.7.0-debian-10-r69')).toBe(
        true
      );
      expect(re.matches('12.7.0-debian-9-r69', '12.7.0-debian-10-r68')).toBe(
        true
      );
    });
  });
});
