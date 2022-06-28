import { HermitVersioning } from './index';

describe('modules/versioning/hermit/index', () => {
  const versioning = new HermitVersioning();

  describe('_parseVersion', () => {
    test.each`
      version           | release           | compatibility | prerelease
      ${'17'}           | ${[17, 0, 0]}     | ${undefined}  | ${undefined}
      ${'17.2'}         | ${[17, 2, 0]}     | ${undefined}  | ${undefined}
      ${'17.2.3a1'}     | ${[17, 2, 3]}     | ${undefined}  | ${'a1'}
      ${'17.2.3-foo'}   | ${[17, 2, 3]}     | ${undefined}  | ${'foo'}
      ${'17.2.3+m1'}    | ${[17, 2, 3]}     | ${'m1'}       | ${undefined}
      ${'17.2.3_40+m1'} | ${[17, 2, 3, 40]} | ${'m1'}       | ${undefined}
      ${'@17'}          | ${[17]}           | ${undefined}  | ${undefined}
      ${'@17.2'}        | ${[17, 2]}        | ${undefined}  | ${undefined}
      ${'@17.2.3_40'}   | ${[17, 2, 3, 40]} | ${undefined}  | ${undefined}
    `(
      'getReleases for "$version"',
      ({ version, release, compatibility, prerelease }) => {
        const res = versioning._parseVersion(version);
        if (res === null) {
          throw new Error('res is null');
        }
        expect(res.release).toStrictEqual(release);
        expect(res.compatibility).toStrictEqual(compatibility);
        expect(res.prerelease).toStrictEqual(prerelease);
      }
    );

    it('non semver channel will receive a null', () => {
      expect(versioning._parseVersion('@stable')).toBeNull();
    });
  });

  describe('_isChannel', () => {
    test.each`
      version                     | expected
      ${'1'}                      | ${false}
      ${'1rc1'}                   | ${false}
      ${'1-foo'}                  | ${false}
      ${'1+bar'}                  | ${false}
      ${'1.2'}                    | ${false}
      ${'1.2-foo'}                | ${false}
      ${'1.2+bar'}                | ${false}
      ${'1.2.3'}                  | ${false}
      ${'1.2.3rc1'}               | ${false}
      ${'1.2.3-foo'}              | ${false}
      ${'1.2.3+bar'}              | ${false}
      ${'17.0.1_12'}              | ${false}
      ${'17.0.1_12+m1'}           | ${false}
      ${'17.0.1_12+m1'}           | ${false}
      ${'11.0.11_9-zulu11.48.21'} | ${false}
      ${'1.2-kotlin.3'}           | ${false}
      ${'@1'}                     | ${true}
      ${'@1.2'}                   | ${true}
      ${'@1.2.3'}                 | ${true}
      ${'@latest'}                | ${true}
      ${'@stable'}                | ${true}
    `('isChannel("$version") === $expected', ({ version, expected }) => {
      expect(versioning._isChannel(version)).toBe(expected);
    });
  });

  describe('_isSemverChannel', () => {
    test.each`
      version      | expected
      ${'@1'}      | ${true}
      ${'@1.2'}    | ${true}
      ${'@1.2.3'}  | ${true}
      ${'@latest'} | ${false}
      ${'@stable'} | ${false}
    `('isSemverChannel("$version") === $expected', ({ version, expected }) => {
      expect(!!versioning._isSemverChannel(version)).toBe(expected);
    });
  });

  describe('isStable', () => {
    test.each`
      version      | expected
      ${'1'}       | ${true}
      ${'1.2'}     | ${true}
      ${'@1'}      | ${false}
      ${'@1.2'}    | ${false}
      ${'@1.2.3'}  | ${false}
      ${'@latest'} | ${false}
      ${'@stable'} | ${false}
    `('isStable("$version") === $expected', ({ version, expected }) => {
      expect(!!versioning.isStable(version)).toBe(expected);
    });
  });

  describe('isValid', () => {
    test.each`
      version                     | expected
      ${'1'}                      | ${true}
      ${'1rc1'}                   | ${true}
      ${'1-foo'}                  | ${true}
      ${'1+bar'}                  | ${true}
      ${'1.2'}                    | ${true}
      ${'1.2-foo'}                | ${true}
      ${'1.2+bar'}                | ${true}
      ${'1.2.3'}                  | ${true}
      ${'1.2.3rc1'}               | ${true}
      ${'1.2.3-foo'}              | ${true}
      ${'1.2.3+bar'}              | ${true}
      ${'17.0.1_12'}              | ${true}
      ${'17.0.1_12+m1'}           | ${true}
      ${'17.0.1_12+m1'}           | ${true}
      ${'11.0.11_9-zulu11.48.21'} | ${true}
      ${'1.2-kotlin.3'}           | ${true}
      ${'@1'}                     | ${true}
      ${'@1.2'}                   | ${true}
      ${'@1.2.3'}                 | ${true}
      ${'@latest'}                | ${true}
      ${'@stable'}                | ${true}
    `('isValid("$version") === $expected', ({ version, expected }) => {
      expect(!!versioning.isValid(version)).toBe(expected);
    });
  });

  describe('getMajor, getMinor, getPatch', () => {
    test.each`
      version         | major   | minor   | patch
      ${'17'}         | ${17}   | ${0}    | ${0}
      ${'17.2'}       | ${17}   | ${2}    | ${0}
      ${'17.2.3a1'}   | ${17}   | ${2}    | ${3}
      ${'17.2.3-foo'} | ${17}   | ${2}    | ${3}
      ${'17.2.3+m1'}  | ${17}   | ${2}    | ${3}
      ${'@17'}        | ${17}   | ${null} | ${null}
      ${'@17.2'}      | ${17}   | ${2}    | ${null}
      ${'@stable'}    | ${null} | ${null} | ${null}
    `(
      'getMajor, getMinor, getPatch for "$version"',
      ({ version, major, minor, patch }) => {
        expect(versioning.getMajor(version)).toBe(major);
        expect(versioning.getMinor(version)).toBe(minor);
        expect(versioning.getPatch(version)).toBe(patch);
      }
    );
  });

  describe('equals', () => {
    test.each`
      version       | other        | expected
      ${'1'}        | ${'1.2'}     | ${false}
      ${'@1'}       | ${'@1.2'}    | ${false}
      ${'@1.2'}     | ${'@1.2'}    | ${true}
      ${'@1.2'}     | ${'@1.3'}    | ${false}
      ${'@1.2.3'}   | ${'@1.2'}    | ${false}
      ${'@1.2.3_4'} | ${'@1.2.3'}  | ${false}
      ${'@latest'}  | ${'@1'}      | ${false}
      ${'@stable'}  | ${'@stable'} | ${true}
      ${'stable'}   | ${'stable'}  | ${true}
    `('equals("$version") === $expected', ({ version, other, expected }) => {
      expect(!!versioning.equals(version, other)).toBe(expected);
    });
  });

  describe('matches', () => {
    test.each`
      version      | other        | expected
      ${'@1'}      | ${'@1.2'}    | ${false}
      ${'@1.2'}    | ${'@1.2'}    | ${true}
      ${'@1.2.3'}  | ${'@1.2'}    | ${false}
      ${'@latest'} | ${'@1'}      | ${false}
      ${'@stable'} | ${'@stable'} | ${true}
    `('matches("$version") === $expected', ({ version, other, expected }) => {
      expect(!!versioning.matches(version, other)).toBe(expected);
    });
  });

  describe('isGreaterThan', () => {
    test.each`
      version      | other        | expected
      ${'@1'}      | ${'@1.2'}    | ${true}
      ${'@1.2'}    | ${'@1.2'}    | ${false}
      ${'@1.2'}    | ${'@1.3'}    | ${false}
      ${'@1.2.3'}  | ${'@1.2'}    | ${false}
      ${'1.2.3'}   | ${'@latest'} | ${true}
      ${'@latest'} | ${'@1'}      | ${false}
      ${'@stable'} | ${'@latest'} | ${true}
      ${'@latest'} | ${'@stable'} | ${false}
    `(
      'isGreaterThan("$version", "$other") === $expected',
      ({ version, other, expected }) => {
        expect(!!versioning.isGreaterThan(version, other)).toBe(expected);
      }
    );
  });

  describe('isLesserThanRange', () => {
    test.each`
      version      | other        | expected
      ${'@1'}      | ${'@1.2'}    | ${false}
      ${'@1.2'}    | ${'@1.2'}    | ${true}
      ${'@1.2.3'}  | ${'@1.2'}    | ${true}
      ${'@latest'} | ${'@1'}      | ${true}
      ${'@stable'} | ${'@latest'} | ${false}
      ${'@latest'} | ${'@stable'} | ${true}
    `(
      'isLessThanRange("$version") === $expected',
      ({ version, other, expected }) => {
        expect(!!versioning.isLessThanRange(version, other)).toBe(expected);
      }
    );
  });

  it('getSatisfyingVersion', () => {
    expect(versioning.getSatisfyingVersion(['@1.1.1', '1.2.3'], '1.2.3')).toBe(
      '1.2.3'
    );
    expect(
      versioning.getSatisfyingVersion(
        ['1.1.1', '@2.2.1', '2.2.2', '3.3.3'],
        '2.2.2'
      )
    ).toBe('2.2.2');
    expect(
      versioning.getSatisfyingVersion(
        ['1.1.1', '@1.3.3', '2.2.2', '3.3.3'],
        '1.2.3'
      )
    ).toBeNull();
  });

  it('minSatisfyingVersion', () => {
    expect(versioning.minSatisfyingVersion(['@1.1.1', '1.2.3'], '1.2.3')).toBe(
      '1.2.3'
    );
    expect(
      versioning.minSatisfyingVersion(
        ['1.1.1', '@1.2.3', '2.2.2', '3.3.3'],
        '2.2.2'
      )
    ).toBe('2.2.2');
    expect(
      versioning.minSatisfyingVersion(
        ['1.1.1', '@1.2.2', '2.2.2', '3.3.3'],
        '1.2.3'
      )
    ).toBeNull();
  });

  describe('sortVresions', () => {
    it('sorts versions in an ascending order', () => {
      expect(
        [
          '@1',
          '1.1',
          '1.2',
          '1.2.3',
          '1.3',
          '@1.2',
          '@2',
          '2',
          '2.1',
          '@stable',
          '@latest',
        ].sort(versioning.sortVersions.bind(versioning))
      ).toEqual([
        '@latest',
        '@stable',
        '1.1',
        '1.2',
        '1.2.3',
        '@1.2',
        '1.3',
        '@1',
        '2',
        '2.1',
        '@2',
      ]);
    });
  });
});
