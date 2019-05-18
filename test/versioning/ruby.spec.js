const semverRuby = require('../../lib/versioning/ruby');

describe('semverRuby', () => {
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
      expect(semverRuby.getMinor('1')).toBeNull();
    });
  });

  describe('.getPatch', () => {
    it('returns patch segment of version when it present', () => {
      expect(semverRuby.getPatch('1.2.2')).toEqual(2);
      expect(semverRuby.getPatch('1.2.1.alpha.4')).toEqual(1);
    });

    it('returns null when patch segment absent', () => {
      expect(semverRuby.getPatch('1')).toBeNull();
      expect(semverRuby.getPatch('1.2')).toBeNull();
    });
  });

  describe('.isVersion', () => {
    it('returns true when version is valid', () => {
      expect(semverRuby.isVersion('1')).toBe(true);
      expect(semverRuby.isVersion('1.1')).toBe(true);
      expect(semverRuby.isVersion('1.1.2')).toBe(true);
      expect(semverRuby.isVersion('1.1.2.3')).toBe(true);
      expect(semverRuby.isVersion('1.1.2-4')).toBe(true);
      expect(semverRuby.isVersion('1.1.2.pre.4')).toBe(true);
    });

    it('returns false when version is invalid', () => {
      expect(semverRuby.isVersion()).toBe(false);
      expect(semverRuby.isVersion('')).toBe(false);
      expect(semverRuby.isVersion(null)).toBe(false);
      expect(semverRuby.isVersion('tottally-not-a-version')).toBe(false);
    });
  });

  describe('.isGreaterThan', () => {
    it('returns true when version is greater than another', () => {
      expect(semverRuby.isGreaterThan('2', '1')).toBe(true);
      expect(semverRuby.isGreaterThan('2.2', '2.1')).toBe(true);
      expect(semverRuby.isGreaterThan('2.2.1', '2.2.0')).toBe(true);
      expect(semverRuby.isGreaterThan('3.0.0.rc2', '3.0.0.rc1')).toBe(true);
      expect(semverRuby.isGreaterThan('3.0.0-rc.2', '3.0.0-rc.1')).toBe(true);
      expect(semverRuby.isGreaterThan('3.0.0.rc1', '3.0.0.beta')).toBe(true);
      expect(semverRuby.isGreaterThan('3.0.0-rc.1', '3.0.0-beta')).toBe(true);
      expect(semverRuby.isGreaterThan('3.0.0.beta', '3.0.0.alpha')).toBe(true);
      expect(semverRuby.isGreaterThan('3.0.0-beta', '3.0.0-alpha')).toBe(true);
      expect(semverRuby.isGreaterThan('5.0.1.rc1', '5.0.1.beta1')).toBe(true);
      expect(semverRuby.isGreaterThan('5.0.1-rc.1', '5.0.1-beta.1')).toBe(true);
    });

    it('returns false when version is lower than another', () => {
      expect(semverRuby.isGreaterThan('1', '2')).toBe(false);
      expect(semverRuby.isGreaterThan('2.1', '2.2')).toBe(false);
      expect(semverRuby.isGreaterThan('2.2.0', '2.2.1')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0.rc1', '3.0.0.rc2')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0-rc.1', '3.0.0-rc.2')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0.beta', '3.0.0.rc1')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0-beta', '3.0.0-rc.1')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0.alpha', '3.0.0.beta')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0-alpha', '3.0.0-beta')).toBe(false);
      expect(semverRuby.isGreaterThan('5.0.1.beta1', '5.0.1.rc1')).toBe(false);
      expect(semverRuby.isGreaterThan('5.0.1-beta.1', '5.0.1-rc.1')).toBe(
        false
      );
    });

    it('returns false when versions are equal', () => {
      expect(semverRuby.isGreaterThan('1', '1')).toBe(false);
      expect(semverRuby.isGreaterThan('2.1', '2.1')).toBe(false);
      expect(semverRuby.isGreaterThan('2.2.0', '2.2.0')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0.rc1', '3.0.0.rc1')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0-rc.1', '3.0.0-rc.1')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0.beta', '3.0.0.beta')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0-beta', '3.0.0-beta')).toBe(false);
      expect(semverRuby.isGreaterThan('3.0.0.alpha', '3.0.0.alpha')).toBe(
        false
      );
      expect(semverRuby.isGreaterThan('3.0.0-alpha', '3.0.0-alpha')).toBe(
        false
      );
      expect(semverRuby.isGreaterThan('5.0.1.beta1', '5.0.1.beta1')).toBe(
        false
      );
      expect(semverRuby.isGreaterThan('5.0.1-beta.1', '5.0.1-beta.1')).toBe(
        false
      );
    });
  });

  describe('.isStable', () => {
    it('returns true when version is stable', () => {
      expect(semverRuby.isStable('1')).toBe(true);
      expect(semverRuby.isStable('1.2')).toBe(true);
      expect(semverRuby.isStable('1.2.3')).toBe(true);
    });

    it('returns false when version is prerelease', () => {
      expect(semverRuby.isStable('1.2.0-alpha')).toBe(false);
      expect(semverRuby.isStable('1.2.0.alpha')).toBe(false);
      expect(semverRuby.isStable('1.2.0.alpha1')).toBe(false);
      expect(semverRuby.isStable('1.2.0-alpha.1')).toBe(false);
    });

    it('returns false when version is invalid', () => {
      expect(semverRuby.isStable()).toBe(false);
      expect(semverRuby.isStable('')).toBe(false);
      expect(semverRuby.isStable(null)).toBe(false);
      expect(semverRuby.isStable('tottally-not-a-version')).toBe(false);
    });
  });

  describe('.sortVersions', () => {
    it('sorts versions in an ascending order', () => {
      expect(
        ['1.2.3-beta', '2.0.1', '1.3.4', '1.2.3'].sort(semverRuby.sortVersions)
      ).toEqual(['1.2.3-beta', '1.2.3', '1.3.4', '2.0.1']);
    });
  });

  describe('.minSatisfyingVersion', () => {
    it('returns lowest version that matches range', () => {
      expect(
        semverRuby.minSatisfyingVersion(['2.1.5', '2.1.6'], '~> 2.1')
      ).toEqual('2.1.5');

      expect(
        semverRuby.minSatisfyingVersion(['2.1.6', '2.1.5'], '~> 2.1.6')
      ).toEqual('2.1.6');

      expect(
        semverRuby.minSatisfyingVersion(
          ['4.7.3', '4.7.4', '4.7.5', '4.7.9'],
          '~> 4.7, >= 4.7.4'
        )
      ).toEqual('4.7.4');

      expect(
        semverRuby.minSatisfyingVersion(
          ['2.5.3', '2.5.4', '2.5.5', '2.5.6'],
          '~>2.5.3'
        )
      ).toEqual('2.5.3');

      expect(
        semverRuby.minSatisfyingVersion(
          ['2.1.0', '3.0.0.beta', '2.3', '3.0.0-rc.1', '3.0.0', '3.1.1'],
          '~> 3.0'
        )
      ).toEqual('3.0.0');
    });

    it('returns null if version that matches range absent', () => {
      expect(
        semverRuby.minSatisfyingVersion(['1.2.3', '1.2.4'], '>= 3.5.0')
      ).toBeNull();
    });
  });

  describe('.maxSatisfyingVersion', () => {
    it('returns greatest version that matches range', () => {
      expect(
        semverRuby.maxSatisfyingVersion(['2.1.5', '2.1.6'], '~> 2.1')
      ).toEqual('2.1.6');

      expect(
        semverRuby.maxSatisfyingVersion(['2.1.6', '2.1.5'], '~> 2.1.6')
      ).toEqual('2.1.6');

      expect(
        semverRuby.maxSatisfyingVersion(
          ['4.7.3', '4.7.4', '4.7.5', '4.7.9'],
          '~> 4.7, >= 4.7.4'
        )
      ).toEqual('4.7.9');

      expect(
        semverRuby.maxSatisfyingVersion(
          ['2.5.3', '2.5.4', '2.5.5', '2.5.6'],
          '~>2.5.3'
        )
      ).toEqual('2.5.6');

      expect(
        semverRuby.maxSatisfyingVersion(
          ['2.1.0', '3.0.0.beta', '2.3', '3.0.0-rc.1', '3.0.0', '3.1.1'],
          '~> 3.0'
        )
      ).toEqual('3.1.1');
    });

    it('returns null if version that matches range absent', () => {
      expect(
        semverRuby.maxSatisfyingVersion(['1.2.3', '1.2.4'], '>= 3.5.0')
      ).toBeNull();
    });
  });

  describe('.matches', () => {
    it('returns true when version match range', () => {
      expect(semverRuby.matches('1.2', '>= 1.2')).toBe(true);
      expect(semverRuby.matches('1.2.3', '~> 1.2.1')).toBe(true);
      expect(semverRuby.matches('1.2.7', '1.2.7')).toBe(true);
      expect(semverRuby.matches('1.1.6', '>= 1.1.5, < 2.0')).toBe(true);
    });

    it('returns false when version not match range', () => {
      expect(semverRuby.matches('1.2', '>= 1.3')).toBe(false);
      expect(semverRuby.matches('1.3.8', '~> 1.2.1')).toBe(false);
      expect(semverRuby.matches('1.3.9', '1.3.8')).toBe(false);
      expect(semverRuby.matches('2.0.0', '>= 1.1.5, < 2.0')).toBe(false);
    });
  });

  describe('.isLessThanRange', () => {
    it('returns true when version less than range', () => {
      expect(semverRuby.isLessThanRange('1.2.2', '< 1.2.2')).toBe(true);
      expect(semverRuby.isLessThanRange('1.1.4', '>= 1.1.5, < 2.0')).toBe(true);
      expect(semverRuby.isLessThanRange('1.2.0-alpha', '1.2.0-beta')).toBe(
        true
      );
      expect(semverRuby.isLessThanRange('1.2.2', '> 1.2.2, ~> 2.0.0')).toBe(
        true
      );
    });

    it('returns false when version greater or satisfies range', () => {
      expect(semverRuby.isLessThanRange('1.2.2', '<= 1.2.2')).toBe(false);
      expect(semverRuby.isLessThanRange('2.0.0', '>= 1.1.5, < 2.0')).toBe(
        false
      );
      expect(semverRuby.isLessThanRange('1.2.0-beta', '1.2.0-alpha')).toBe(
        false
      );
      expect(semverRuby.isLessThanRange('2.0.0', '> 1.2.2, ~> 2.0.0')).toBe(
        false
      );
    });
  });

  describe('.isValid', () => {
    it('returns true when version is valid', () => {
      expect(semverRuby.isValid('1')).toBe(true);
      expect(semverRuby.isValid('1.1')).toBe(true);
      expect(semverRuby.isValid('1.1.2')).toBe(true);
      expect(semverRuby.isValid('1.2.0.alpha1')).toBe(true);
      expect(semverRuby.isValid('1.2.0-alpha.1')).toBe(true);

      expect(semverRuby.isValid('= 1')).toBe(true);
      expect(semverRuby.isValid('!= 1.1')).toBe(true);
      expect(semverRuby.isValid('> 1.1.2')).toBe(true);
      expect(semverRuby.isValid('< 1.0.0-beta')).toBe(true);
      expect(semverRuby.isValid('>= 1.0.0.beta')).toBe(true);
      expect(semverRuby.isValid('<= 1.2.0.alpha1')).toBe(true);
      expect(semverRuby.isValid('~> 1.2.0-alpha.1')).toBe(true);
    });

    it('returns true when range is valid', () => {
      expect(semverRuby.isValid('>= 3.0.5, < 3.2')).toBe(true);
    });

    it('returns false when version is invalid', () => {
      expect(semverRuby.isVersion()).toBe(false);
      expect(semverRuby.isVersion('')).toBe(false);
      expect(semverRuby.isVersion(null)).toBe(false);
      expect(semverRuby.isVersion('tottally-not-a-version')).toBe(false);

      expect(semverRuby.isValid('+ 1')).toBe(false);
      expect(semverRuby.isValid('- 1.1')).toBe(false);
      expect(semverRuby.isValid('=== 1.1.2')).toBe(false);
      expect(semverRuby.isValid('! 1.0.0-beta')).toBe(false);
      expect(semverRuby.isValid('& 1.0.0.beta')).toBe(false);
    });
  });

  describe('.isSingleVersion', () => {
    it('returns true when version is single', () => {
      expect(semverRuby.isSingleVersion('1')).toBe(true);
      expect(semverRuby.isSingleVersion('1.2')).toBe(true);
      expect(semverRuby.isSingleVersion('1.2.1')).toBe(true);

      expect(semverRuby.isSingleVersion('=1')).toBe(true);
      expect(semverRuby.isSingleVersion('=1.2')).toBe(true);
      expect(semverRuby.isSingleVersion('=1.2.1')).toBe(true);

      expect(semverRuby.isSingleVersion('= 1')).toBe(true);
      expect(semverRuby.isSingleVersion('= 1.2')).toBe(true);
      expect(semverRuby.isSingleVersion('= 1.2.1')).toBe(true);

      expect(semverRuby.isSingleVersion('1.2.1.rc1')).toBe(true);
      expect(semverRuby.isSingleVersion('1.2.1-rc.1')).toBe(true);

      expect(semverRuby.isSingleVersion('= 1.2.0.alpha')).toBe(true);
      expect(semverRuby.isSingleVersion('= 1.2.0-alpha')).toBe(true);
    });

    it('returns false when version is multiple', () => {
      expect(semverRuby.isSingleVersion('!= 1')).toBe(false);
      expect(semverRuby.isSingleVersion('> 1.2')).toBe(false);
      expect(semverRuby.isSingleVersion('< 1.2.1')).toBe(false);
      expect(semverRuby.isSingleVersion('>= 1')).toBe(false);
      expect(semverRuby.isSingleVersion('<= 1.2')).toBe(false);
      expect(semverRuby.isSingleVersion('~> 1.2.1')).toBe(false);
    });

    it('returns false when version is invalid', () => {
      expect(semverRuby.isSingleVersion()).toBe(false);
      expect(semverRuby.isSingleVersion('')).toBe(false);
      expect(semverRuby.isSingleVersion(null)).toBe(false);
      expect(semverRuby.isSingleVersion('tottally-not-a-version')).toBe(false);
    });
  });

  describe('.getNewValue', () => {
    it('returns correct version for pin strategy', () => {
      [
        ['1.2.3', '1.0.3', 'pin', '1.0.3', '1.2.3'],
        ['1.2.3', '= 1.0.3', 'pin', '1.0.3', '1.2.3'],
        ['1.2.3', '!= 1.0.3', 'pin', '1.0.4', '1.2.3'],
        ['1.2.3', '> 1.0.3', 'pin', '1.0.4', '1.2.3'],
        ['1.2.3', '< 1.0.3', 'pin', '1.0.2', '1.2.3'],
        ['1.2.3', '>= 1.0.3', 'pin', '1.0.4', '1.2.3'],
        ['1.2.3', '<= 1.0.3', 'pin', '1.0.3', '1.2.3'],
        ['1.2.3', '~> 1.0.3', 'pin', '1.0.4', '1.2.3'],
        ['4.7.8', '~> 4.7, >= 4.7.4', 'pin', '4.7.5', '4.7.8'],
      ].forEach(([expected, ...params]) => {
        expect(semverRuby.getNewValue(...params)).toEqual(expected);
      });
    });

    it('returns correct version for bump strategy', () => {
      [
        ['1.2.3', '1.0.3', 'bump', '1.0.3', '1.2.3'],
        ['= 1.2.3', '= 1.0.3', 'bump', '1.0.3', '1.2.3'],
        ['!= 1.0.3', '!= 1.0.3', 'bump', '1.0.0', '1.2.3'],
        ['> 1.2.2', '> 1.0.3', 'bump', '1.0.4', '1.2.3'],
        ['< 1.2.4', '< 1.0.3', 'bump', '1.0.0', '1.2.3'],
        ['< 1.2.4', '< 1.2.2', 'bump', '1.0.0', '1.2.3'],
        ['< 1.2.4', '< 1.2.3', 'bump', '1.0.0', '1.2.3'],
        ['< 1.3', '< 1.2', 'bump', '1.0.0', '1.2.3'],
        ['< 2', '< 1', 'bump', '0.9.0', '1.2.3'],
        ['>= 1.2.3', '>= 1.0.3', 'bump', '1.0.3', '1.2.3'],
        ['<= 1.2.3', '<= 1.0.3', 'bump', '1.0.3', '1.2.3'],
        ['~> 1.2.0', '~> 1.0.3', 'bump', '1.0.3', '1.2.3'],
        ['~> 1.0.0', '~> 1.0.3', 'bump', '1.0.3', '1.0.4'],
        ['~> 4.7.0, >= 4.7.9', '~> 4.7, >= 4.7.4', 'bump', '4.7.5', '4.7.9'],
      ].forEach(([expected, ...params]) => {
        expect(semverRuby.getNewValue(...params)).toEqual(expected);
      });
    });

    it('does not error', () => {
      expect(
        semverRuby.getNewValue('>= 3.2, < 5.0', 'replace', '4.0.2', '6.0.1')
      ).toMatchSnapshot();
    });

    it('returns correct version for replace strategy', () => {
      [
        ['1.2.3', '1.0.3', 'replace', '1.0.3', '1.2.3'],
        ['= 1.2.3', '= 1.0.3', 'replace', '1.0.3', '1.2.3'],
        ['!= 1.0.3', '!= 1.0.3', 'replace', '1.0.0', '1.2.3'],
        ['< 1.2.4', '< 1.0.3', 'replace', '1.0.0', '1.2.3'],
        ['< 1.2.4', '< 1.2.2', 'replace', '1.0.0', '1.2.3'],
        ['< 1.2.4', '< 1.2.3', 'replace', '1.0.0', '1.2.3'],
        ['< 1.3', '< 1.2', 'replace', '1.0.0', '1.2.3'],
        ['< 2', '< 1', 'replace', '0.9.0', '1.2.3'],
        ['< 1.2.3', '< 1.2.3', 'replace', '1.0.0', '1.2.2'],
        ['>= 1.0.3', '>= 1.0.3', 'replace', '1.0.3', '1.2.3'],
        ['<= 1.2.3', '<= 1.0.3', 'replace', '1.0.0', '1.2.3'],
        ['<= 1.0.3', '<= 1.0.3', 'replace', '1.0.0', '1.0.2'],
        ['~> 1.2.0', '~> 1.0.3', 'replace', '1.0.0', '1.2.3'],
        ['~> 1.0.3', '~> 1.0.3', 'replace', '1.0.0', '1.0.4'],
        ['~> 4.7, >= 4.7.4', '~> 4.7, >= 4.7.4', 'replace', '1.0.0', '4.7.9'],
        [
          '>= 2.0.0, <= 2.20.0',
          '>= 2.0.0, <= 2.15',
          'replace',
          '2.15.0',
          '2.20.0',
        ],
      ].forEach(([expected, ...params]) => {
        expect(semverRuby.getNewValue(...params)).toEqual(expected);
      });
    });
  });
});
