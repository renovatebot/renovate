import { get } from '../../lib/versioning';

const regex = get(
  'regex',
  '^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(-(?<architecture>.*))?$'
);

describe('regex', () => {
  it('requires a valid configuration to be initialized', () => {
    expect(get('regex', 'not a regex')).toBe(null);
  });

  describe('.parse()', () => {
    it('parses invalid matches as invalid', () => {
      expect(regex.isValid('1')).toBe(false);
      expect(regex.isValid('aardvark')).toBe(false);
      expect(regex.isValid('1.2a1-foo')).toBe(false);
    });
  });

  describe('.isCompatible', () => {
    it('returns true when the architectures are equal', () => {
      expect(regex.isCompatible('1.2.3', '2.3.4')).toBe(true);
      expect(regex.isCompatible('1.2.3a1', '2.3.4')).toBe(true);
      expect(regex.isCompatible('1.2.3', '2.3.4b1')).toBe(true);
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4-foobar')).toBe(true);
      expect(regex.isCompatible('1.2.3a1-foobar', '2.3.4-foobar')).toBe(true);
      expect(regex.isCompatible('1.2.3-foobar', '2.3.4b1-foobar')).toBe(true);
    });

    it('returns false when the architectures are different', () => {
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

    it('retuns true when only architecture differs', () => {
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

    it('ignores architecture differences', () => {
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
      expect(regex.isLessThanRange('1.2.2', '> 1.2.2')).toBe(true);
      expect(regex.isLessThanRange('1.1.4', '>= 1.1.5 < 2.0')).toBe(true);
      expect(regex.isLessThanRange('1.2.0a1', '1.2.0')).toBe(true);
      expect(regex.isLessThanRange('1.2.2', '> 1.2.2 ~> 2.0.0')).toBe(true);
      expect(regex.isLessThanRange('1.2.2-foo', '> 1.2.2')).toBe(true);
      expect(regex.isLessThanRange('1.1.4-foo', '>= 1.1.5 < 2.0')).toBe(true);
      expect(regex.isLessThanRange('1.2.0a1-foo', '1.2.0')).toBe(true);
      expect(regex.isLessThanRange('1.2.2-foo', '> 1.2.2 ~> 2.0.0')).toBe(true);
    });

    it('returns false when version greater or satisfies range', () => {
      expect(regex.isLessThanRange('1.2.2', '<= 1.2.2')).toBe(false);
      expect(regex.isLessThanRange('2.0.0', '>= 1.1.5 < 2.0')).toBe(false);
      expect(regex.isLessThanRange('1.2.0b2', '1.1.9')).toBe(false);
      expect(regex.isLessThanRange('2.0.0', '> 1.2.2 ~> 2.0.0')).toBe(false);
      expect(regex.isLessThanRange('1.2.2-foo', '<= 1.2.2')).toBe(false);
      expect(regex.isLessThanRange('2.0.0-foo', '>= 1.1.5 < 2.0')).toBe(false);
      expect(regex.isLessThanRange('1.2.0b2-foo', '1.1.9')).toBe(false);
      expect(regex.isLessThanRange('2.0.0-foo', '> 1.2.2 ~> 2.0.0')).toBe(
        false
      );
    });
  });

  describe('.maxSatisfyingVersion', () => {
    it('returns greatest version that matches range', () => {
      expect(regex.maxSatisfyingVersion(['2.1.5', '2.1.6'], '~> 2.1')).toEqual(
        '2.1.6'
      );
      expect(
        regex.maxSatisfyingVersion(['2.1.6', '2.1.5'], '~> 2.1.6')
      ).toEqual('2.1.6');
      // Note: `maxSatisfyingVersion()` does not care about `.isCompatible()`
      expect(
        regex.maxSatisfyingVersion(['2.1.6-foo', '2.1.5'], '~> 2.1.6')
      ).toEqual('2.1.6');
      expect(
        regex.maxSatisfyingVersion(['2.1.6', '2.1.6a1', '2.1.5'], '~> 2.1')
      ).toEqual('2.1.6');
    });

    it('returns null if version that matches range absent', () => {
      expect(
        regex.maxSatisfyingVersion(['1.2.3', '1.2.4'], '>= 3.5.0')
      ).toBeNull();
    });
  });

  describe('.minSatisfyingVersion', () => {
    it('returns greatest version that matches range', () => {
      expect(regex.minSatisfyingVersion(['2.1.5', '2.1.6'], '~> 2.1')).toEqual(
        '2.1.5'
      );
      expect(
        regex.minSatisfyingVersion(['2.1.6', '2.1.5'], '~> 2.1.6')
      ).toEqual('2.1.6');
      // Note: `minSatisfyingVersion()` does not care about `.isCompatible()`
      expect(
        regex.minSatisfyingVersion(['2.1.6', '2.1.5-foo'], '~> 2.1')
      ).toEqual('2.1.5');
    });

    it('returns null if version that matches range absent', () => {
      expect(
        regex.minSatisfyingVersion(['1.2.3', '1.2.4'], '>= 3.5.0')
      ).toBeNull();
    });
  });

  describe('.getNewValue', () => {
    it('returns toVersion', () => {
      expect(regex.getNewValue(null, null, null, '1.2.3')).toBe('1.2.3');
    });
  });

  describe('.sortVersions', () => {
    it('sorts versions in an ascending order', () => {
      expect(
        ['1.2.3a1', '2.0.1', '1.3.4', '1.2.3'].sort(regex.sortVersions)
      ).toEqual(['1.2.3a1', '1.2.3', '1.3.4', '2.0.1']);
    });
  });

  describe('.matches', () => {
    it('returns true when version match range', () => {
      expect(regex.matches('1.2.1', '>= 1.2')).toBe(true);
      expect(regex.matches('1.2.3', '~> 1.2.1')).toBe(true);
      expect(regex.matches('1.2.7', '1.2.7')).toBe(true);
      expect(regex.matches('1.1.6', '> 1.1.5 < 2.0')).toBe(true);
      expect(regex.matches('1.2.1-foo', '>= 1.2')).toBe(true);
      expect(regex.matches('1.2.3-foo', '~> 1.2.1')).toBe(true);
      expect(regex.matches('1.2.7-foo', '1.2.7')).toBe(true);
      expect(regex.matches('1.1.6-foo', '> 1.1.5 < 2.0')).toBe(true);
    });

    it('returns false when version not match range', () => {
      expect(regex.matches('1.2.1', '>= 1.3')).toBe(false);
      expect(regex.matches('1.3.8', '~> 1.2.1')).toBe(false);
      expect(regex.matches('1.3.9', '1.3.8')).toBe(false);
      expect(regex.matches('2.0.0', '> 1.1.5 < 2.0')).toBe(false);
      expect(regex.matches('1.2.1-foo', '>= 1.3')).toBe(false);
      expect(regex.matches('1.3.8-foo', '~> 1.2.1')).toBe(false);
      expect(regex.matches('1.3.9-foo', '1.3.8')).toBe(false);
      expect(regex.matches('2.0.0-foo', '> 1.1.5 < 2.0')).toBe(false);
    });
  });
});
