import { get } from '..';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';

describe('modules/versioning/regex/index', () => {
  describe('regex versioning', () => {
    const regex = get(
      'regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(?:-(?<compatibility>.*))?$',
    );

    it('requires a valid configuration to be initialized', () => {
      expect(() => get('regex:not a regex')).toThrow();
    });

    it('works without config', () => {
      const re = get('regex');
      expect(re.isValid('alpine')).toBeFalse();
    });

    it('works with missing version', () => {
      const re = get('regex:^(?<major>\\d+)?(?<compabillity>.+)');
      expect(re.isValid('alpine')).toBeTrue();
    });

    describe('throws', () => {
      it.each`
        regex
        ${'^(?<major>\\d+)('}
        ${'^(?<major>\\d+)?(?<!y)x$'}
        ${'^(?<major>\\d+)?(?<=y)x$'}
      `(`on invalid regex: "$regex"`, ({ re }: { re: string }) => {
        expect(() => get(`regex:${re}`)).toThrow(CONFIG_VALIDATION);
      });
    });

    it.each`
      version               | expected
      ${'1'}                | ${false}
      ${'aardvark'}         | ${false}
      ${'1.2a1-foo'}        | ${false}
      ${'1.2.3'}            | ${true}
      ${'1.2.3a1'}          | ${true}
      ${'1.2.3b2'}          | ${true}
      ${'1.2.3-foo'}        | ${true}
      ${'1.2.3b2-foo'}      | ${true}
      ${'1.2.3b2-foo-bar'}  | ${true}
      ${'1'}                | ${false}
      ${'1-foo'}            | ${false}
      ${'1.2'}              | ${false}
      ${'1.2-foo'}          | ${false}
      ${'1.2.3.4.5.6.7'}    | ${false}
      ${'1.2.aardvark'}     | ${false}
      ${'1.2.aardvark-foo'} | ${false}
      ${'1.2a2.3'}          | ${false}
    `('isValid("$version") === $expected', ({ version, expected }) => {
      expect(regex.isValid(version)).toBe(expected);
    });

    it.each`
      version             | range               | expected
      ${'1.2.3'}          | ${'2.3.4'}          | ${true}
      ${'1.2.3a1'}        | ${'2.3.4'}          | ${true}
      ${'1.2.3'}          | ${'2.3.4b1'}        | ${true}
      ${'1.2.3-foobar'}   | ${'2.3.4-foobar'}   | ${true}
      ${'1.2.3a1-foobar'} | ${'2.3.4-foobar'}   | ${true}
      ${'1.2.3-foobar'}   | ${'2.3.4b1-foobar'} | ${true}
      ${'1.2.3'}          | ${'2.3.4-foobar'}   | ${false}
      ${'1.2.3a1'}        | ${'2.3.4-foobar'}   | ${false}
      ${'1.2.3'}          | ${'2.3.4b1-foobar'} | ${false}
      ${'1.2.3-foobar'}   | ${'2.3.4'}          | ${false}
      ${'1.2.3a1-foobar'} | ${'2.3.4'}          | ${false}
      ${'1.2.3-foobar'}   | ${'2.3.4b1'}        | ${false}
      ${'1.2.3-foo'}      | ${'2.3.4-bar'}      | ${false}
      ${'1.2.3a1-foo'}    | ${'2.3.4-bar'}      | ${false}
      ${'1.2.3-foo'}      | ${'2.3.4b1-bar'}    | ${false}
    `(
      'isCompatible("$version") === $expected',
      ({ version, range, expected }) => {
        const res = regex.isCompatible(version, range);
        expect(!!res).toBe(expected);
      },
    );

    it.each`
      version               | expected
      ${'1.2.3'}            | ${true}
      ${'1.2.3a1'}          | ${true}
      ${'1.2.3b2'}          | ${true}
      ${'1.2.3-foo'}        | ${true}
      ${'1.2.3b2-foo'}      | ${true}
      ${'1.2.3b2-foo-bar'}  | ${true}
      ${'1'}                | ${false}
      ${'1-foo'}            | ${false}
      ${'1.2'}              | ${false}
      ${'1.2-foo'}          | ${false}
      ${'1.2.3.4.5.6.7'}    | ${false}
      ${'1.2.aardvark'}     | ${false}
      ${'1.2.aardvark-foo'} | ${false}
      ${'1.2a2.3'}          | ${false}
    `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
      const res = !!regex.isSingleVersion(version);
      expect(res).toBe(expected);
    });

    it.each`
      version          | expected
      ${'1.2.3'}       | ${true}
      ${'1.2.3-foo'}   | ${true}
      ${'1.2.3alpha'}  | ${false}
      ${'1.2.3b3-foo'} | ${false}
    `('isStable("$version") === $expected', ({ version, expected }) => {
      const res = !!regex.isStable(version);
      expect(res).toBe(expected);
    });

    it.each`
      version               | expected
      ${'1.2.3'}            | ${true}
      ${'1.2.3a1'}          | ${true}
      ${'1.2.3b2'}          | ${true}
      ${'1.2.3-foo'}        | ${true}
      ${'1.2.3b2-foo'}      | ${true}
      ${'1.2.3b2-foo-bar'}  | ${true}
      ${'1'}                | ${false}
      ${'1-foo'}            | ${false}
      ${'1.2'}              | ${false}
      ${'1.2-foo'}          | ${false}
      ${'1.2.3.4.5.6.7'}    | ${false}
      ${'1.2.aardvark'}     | ${false}
      ${'1.2.aardvark-foo'} | ${false}
      ${'1.2a2.3'}          | ${false}
    `('isVersion("$version") === $expected', ({ version, expected }) => {
      expect(!!regex.isVersion(version)).toBe(expected);
    });

    it.each`
      version          | major | minor | patch
      ${'1.2.3'}       | ${1}  | ${2}  | ${3}
      ${'1.2.3a1'}     | ${1}  | ${2}  | ${3}
      ${'1.2.3a1-foo'} | ${1}  | ${2}  | ${3}
    `(
      'getMajor, getMinor, getPatch for "$version"',
      ({ version, major, minor, patch }) => {
        expect(regex.getMajor(version)).toBe(major);
        expect(regex.getMinor(version)).toBe(minor);
        expect(regex.getPatch(version)).toBe(patch);
      },
    );

    it.each`
      a                | b                | expected
      ${'1.2.3'}       | ${'1.2.3'}       | ${true}
      ${'1.2.3a1'}     | ${'1.2.3a1'}     | ${true}
      ${'1.2.3a1-foo'} | ${'1.2.3a1-foo'} | ${true}
      ${'1.2.3'}       | ${'1.2.3-bar'}   | ${true}
      ${'1.2.3a1'}     | ${'1.2.3a1-bar'} | ${true}
      ${'1.2.3a1-foo'} | ${'1.2.3a1-bar'} | ${true}
      ${'1.2.3'}       | ${'1.2.4'}       | ${false}
      ${'1.2.3'}       | ${'1.3.3'}       | ${false}
      ${'1.2.3'}       | ${'2.2.3'}       | ${false}
      ${'1.2.3'}       | ${'1.2.3a1'}     | ${false}
      ${'1.2.3a1'}     | ${'1.2.3a2'}     | ${false}
      ${'1.2.3'}       | ${'1.2.4-foo'}   | ${false}
      ${'1.2.3'}       | ${'1.3.3-foo'}   | ${false}
      ${'1.2.3'}       | ${'2.2.3-foo'}   | ${false}
      ${'1.2.3'}       | ${'1.2.3a1-foo'} | ${false}
      ${'1.2.3a1'}     | ${'1.2.3a2-foo'} | ${false}
    `('equals($a, $b) === $expected', ({ a, b, expected }) => {
      expect(regex.equals(a, b)).toBe(expected);
    });

    it.each`
      a            | b                | expected
      ${'2.0.0'}   | ${'1.0.0'}       | ${true}
      ${'2.2.0'}   | ${'2.1.0'}       | ${true}
      ${'2.2.1'}   | ${'2.2.0'}       | ${true}
      ${'3.0.0a2'} | ${'3.0.0a1'}     | ${true}
      ${'3.0.0b1'} | ${'3.0.0a2'}     | ${true}
      ${'3.0.0'}   | ${'3.0.0b2'}     | ${true}
      ${'2.0.0'}   | ${'1.0.0-foo'}   | ${true}
      ${'2.2.0'}   | ${'2.1.0-foo'}   | ${true}
      ${'2.2.1'}   | ${'2.2.0-foo'}   | ${true}
      ${'3.0.0a2'} | ${'3.0.0a1-foo'} | ${true}
      ${'3.0.0b1'} | ${'3.0.0a2-foo'} | ${true}
      ${'1.0.0'}   | ${'2.0.0'}       | ${false}
      ${'2.1.0'}   | ${'2.2.0'}       | ${false}
      ${'2.2.1'}   | ${'2.2.2'}       | ${false}
      ${'3.0.0a1'} | ${'3.0.0a2'}     | ${false}
      ${'3.0.0a2'} | ${'3.0.0b1'}     | ${false}
      ${'3.0.0b2'} | ${'3.0.0'}       | ${false}
      ${'1.0.0'}   | ${'1.0.0'}       | ${false}
      ${'2.1.0'}   | ${'2.1.0'}       | ${false}
      ${'2.2.0'}   | ${'2.2.0'}       | ${false}
      ${'3.0.0a1'} | ${'3.0.0a1'}     | ${false}
      ${'3.0.0b2'} | ${'3.0.0b2'}     | ${false}
      ${'1.0.0'}   | ${'1.0.0-foo'}   | ${false}
      ${'2.1.0'}   | ${'2.1.0-foo'}   | ${false}
      ${'2.2.0'}   | ${'2.2.0-foo'}   | ${false}
      ${'3.0.0a1'} | ${'3.0.0a1-foo'} | ${false}
      ${'3.0.0b2'} | ${'3.0.0b2-foo'} | ${false}
    `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(regex.isGreaterThan(a, b)).toBe(expected);
    });

    it.each`
      version          | range            | expected
      ${'1.2.2'}       | ${'1.2.3'}       | ${true}
      ${'1.2.2'}       | ${'1.2.3-bar'}   | ${true}
      ${'1.2.2'}       | ${'1.2.3a1'}     | ${true}
      ${'1.2.2'}       | ${'1.2.3a1-bar'} | ${true}
      ${'1.2.2-foo'}   | ${'1.2.3'}       | ${true}
      ${'1.2.2-foo'}   | ${'1.2.3-bar'}   | ${true}
      ${'1.2.2-foo'}   | ${'1.2.3a1'}     | ${true}
      ${'1.2.2-foo'}   | ${'1.2.3a1-bar'} | ${true}
      ${'1.2.2a1'}     | ${'1.2.3'}       | ${true}
      ${'1.2.2a1'}     | ${'1.2.3-bar'}   | ${true}
      ${'1.2.2a1'}     | ${'1.2.3a1'}     | ${true}
      ${'1.2.2a1'}     | ${'1.2.3a1-bar'} | ${true}
      ${'1.2.2a1-foo'} | ${'1.2.3'}       | ${true}
      ${'1.2.2a1-foo'} | ${'1.2.3-bar'}   | ${true}
      ${'1.2.2a1-foo'} | ${'1.2.3a1'}     | ${true}
      ${'1.2.2a1-foo'} | ${'1.2.3a1-bar'} | ${true}
      ${'1.2.2'}       | ${'1.2.2'}       | ${false}
      ${'1.2.2'}       | ${'1.2.2-bar'}   | ${false}
      ${'1.2.2-foo'}   | ${'1.2.2'}       | ${false}
      ${'1.2.2-foo'}   | ${'1.2.2-bar'}   | ${false}
      ${'1.2.2a1'}     | ${'1.2.2a1'}     | ${false}
      ${'1.2.2a1'}     | ${'1.2.2a1-bar'} | ${false}
      ${'1.2.2a1-foo'} | ${'1.2.2a1'}     | ${false}
      ${'1.2.2a1-foo'} | ${'1.2.2a1-bar'} | ${false}
      ${'1.2.4'}       | ${'1.2.3'}       | ${false}
      ${'1.2.4'}       | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4'}       | ${'1.2.3a1'}     | ${false}
      ${'1.2.4'}       | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3'}       | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3a1'}     | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4a1'}     | ${'1.2.3'}       | ${false}
      ${'1.2.4a1'}     | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4a1'}     | ${'1.2.3a1'}     | ${false}
      ${'1.2.4a1'}     | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3'}       | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3a1'}     | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3a1-bar'} | ${false}
    `(
      'isLessThanRange($version, $range) === $expected',
      ({ version, range, expected }) => {
        expect(regex.isLessThanRange?.(version, range)).toBe(expected);
      },
    );

    it.each`
      versions                                      | range          | expected
      ${['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo']} | ${'2.1.6'}     | ${'2.1.6'}
      ${['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo']} | ${'2.1.6-foo'} | ${'2.1.6'}
      ${['2.1.5-foo', '2.1.6']}                     | ${'2.1.6-foo'} | ${'2.1.6'}
      ${['1.2.3', '1.2.4']}                         | ${'3.5.0'}     | ${null}
      ${['1.2.3', '1.2.4']}                         | ${'!@#'}       | ${null}
    `(
      'getSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(regex.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );

    it.each`
      versions                                      | range          | expected
      ${['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo']} | ${'2.1.6'}     | ${'2.1.6'}
      ${['2.1.5', '2.1.6a1', '2.1.6', '2.1.6-foo']} | ${'2.1.6-foo'} | ${'2.1.6'}
      ${['2.1.5', '2.1.6-foo']}                     | ${'2.1.5-foo'} | ${'2.1.5'}
      ${['1.2.3', '1.2.4']}                         | ${'3.5.0'}     | ${null}
      ${['1.2.3', '1.2.4']}                         | ${'!@#'}       | ${null}
    `(
      'minSatisfyingVersion($versions, "$range") === "$expected"',
      ({ versions, range, expected }) => {
        expect(regex.minSatisfyingVersion(versions, range)).toBe(expected);
      },
    );

    describe('.getNewValue', () => {
      it('returns newVersion', () => {
        expect(
          regex.getNewValue({
            currentValue: null as never,
            rangeStrategy: null as never,
            currentVersion: null as never,
            newVersion: '1.2.3',
          }),
        ).toBe('1.2.3');
      });
    });

    describe('.sortVersions', () => {
      it('sorts versions in an ascending order', () => {
        expect(
          ['1.2.3a1', '2.0.1', '1.3.4', '1.2.3'].sort(
            regex.sortVersions.bind(regex),
          ),
        ).toEqual(['1.2.3a1', '1.2.3', '1.3.4', '2.0.1']);
      });
    });

    it.each`
      version          | range            | expected
      ${'1.2.2'}       | ${'1.2.2'}       | ${true}
      ${'1.2.2'}       | ${'1.2.2-bar'}   | ${true}
      ${'1.2.2-foo'}   | ${'1.2.2'}       | ${true}
      ${'1.2.2-foo'}   | ${'1.2.2-bar'}   | ${true}
      ${'1.2.2a1'}     | ${'1.2.2a1'}     | ${true}
      ${'1.2.2a1'}     | ${'1.2.2a1-bar'} | ${true}
      ${'1.2.2a1-foo'} | ${'1.2.2a1'}     | ${true}
      ${'1.2.2a1-foo'} | ${'1.2.2a1-bar'} | ${true}
      ${'1.2.2'}       | ${'1.2.3'}       | ${false}
      ${'1.2.2'}       | ${'1.2.3-bar'}   | ${false}
      ${'1.2.2'}       | ${'1.2.3a1'}     | ${false}
      ${'1.2.2'}       | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.2-foo'}   | ${'1.2.3'}       | ${false}
      ${'1.2.2-foo'}   | ${'1.2.3-bar'}   | ${false}
      ${'1.2.2-foo'}   | ${'1.2.3a1'}     | ${false}
      ${'1.2.2-foo'}   | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.2a1'}     | ${'1.2.3'}       | ${false}
      ${'1.2.2a1'}     | ${'1.2.3-bar'}   | ${false}
      ${'1.2.2a1'}     | ${'1.2.3a1'}     | ${false}
      ${'1.2.2a1'}     | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.2a1-foo'} | ${'1.2.3'}       | ${false}
      ${'1.2.2a1-foo'} | ${'1.2.3-bar'}   | ${false}
      ${'1.2.2a1-foo'} | ${'1.2.3a1'}     | ${false}
      ${'1.2.2a1-foo'} | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4'}       | ${'1.2.3'}       | ${false}
      ${'1.2.4'}       | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4'}       | ${'1.2.3a1'}     | ${false}
      ${'1.2.4'}       | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3'}       | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3a1'}     | ${false}
      ${'1.2.4-foo'}   | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4a1'}     | ${'1.2.3'}       | ${false}
      ${'1.2.4a1'}     | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4a1'}     | ${'1.2.3a1'}     | ${false}
      ${'1.2.4a1'}     | ${'1.2.3a1-bar'} | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3'}       | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3-bar'}   | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3a1'}     | ${false}
      ${'1.2.4a1-foo'} | ${'1.2.3a1-bar'} | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(regex.matches(version, range)).toBe(expected);
      },
    );
  });

  describe('Supported 4th number as build and 5th as revision', () => {
    const re = get(
      'regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(:?-(?<compatibility>.+)(?<build>\\d+)-r(?<revision>\\d+))?$',
    );

    it.each`
      version                    | expected
      ${'12.7.0-debian-10-r69'}  | ${true}
      ${'12.7.0-debian-10-r100'} | ${true}
    `('isValid("$version") === $expected', ({ version, expected }) => {
      expect(!!re.isValid(version)).toBe(expected);
    });

    it.each`
      version                   | range                      | expected
      ${'12.7.0-debian-10-r69'} | ${'12.7.0-debian-10-r100'} | ${true}
    `(
      'isCompatible("$version") === $expected',
      ({ version, range, expected }) => {
        const res = re.isCompatible(version, range);
        expect(!!res).toBe(expected);
      },
    );

    it.each`
      a                          | b                          | expected
      ${'12.7.0-debian-10-r69'}  | ${'12.7.0-debian-10-r100'} | ${false}
      ${'12.7.0-debian-10-r169'} | ${'12.7.0-debian-10-r100'} | ${true}
    `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(re.isGreaterThan(a, b)).toBe(expected);
    });

    it.each`
      version                  | range                     | expected
      ${'12.7.0-debian-9-r69'} | ${'12.7.0-debian-10-r69'} | ${true}
      ${'12.7.0-debian-9-r69'} | ${'12.7.0-debian-10-r68'} | ${true}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(re.matches(version, range)).toBe(expected);
      },
    );
  });
});
