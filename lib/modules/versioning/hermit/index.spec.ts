import { HermitVersioning } from './index';

describe('modules/versioning/hermit/index', () => {
  const versioning = new HermitVersioning();

  it.each`
    version      | expected
    ${'1'}       | ${true}
    ${'1.2'}     | ${true}
    ${'@1'}      | ${false}
    ${'@1.2'}    | ${false}
    ${'@1.2.3'}  | ${false}
    ${'@latest'} | ${false}
    ${'@stable'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isStable(version)).toBe(expected);
  });

  it.each`
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
    expect(versioning.isValid(version)).toBe(expected);
  });

  it.each`
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
    },
  );

  it.each`
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
  `(
    'equals("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.equals(version, other)).toBe(expected);
    },
  );

  it.each`
    version      | range              | expected
    ${'0.6.1'}   | ${'>0.6.0 <0.7.0'} | ${true}
    ${'0.6.1'}   | ${'<0.7.0'}        | ${true}
    ${'0.6.1'}   | ${'<=0.7.0'}       | ${true}
    ${'0.6.1'}   | ${'>=0.6.0'}       | ${true}
    ${'0.6.1'}   | ${'>0.6.0'}        | ${true}
    ${'0.6.1'}   | ${'0.6.x'}         | ${true}
    ${'0.6.1'}   | ${'0.6.*'}         | ${true}
    ${'0.6.1'}   | ${'0.6.0 - 0.6.3'} | ${true}
    ${'0.6.1'}   | ${'~0.6'}          | ${true}
    ${'0.6.1'}   | ${'0.6.1'}         | ${true}
    ${'0.0.6'}   | ${'^0.0.6'}        | ${true}
    ${'0.0.6'}   | ${'@0.0.6'}        | ${false}
    ${'@0.0.6'}  | ${'0.0.6'}         | ${false}
    ${'@1'}      | ${'@1.2'}          | ${false}
    ${'@1.2'}    | ${'@1.2'}          | ${true}
    ${'@1.2.3'}  | ${'@1.2'}          | ${false}
    ${'@latest'} | ${'@1'}            | ${false}
    ${'@stable'} | ${'@stable'}       | ${true}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(versioning.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    version           | other             | expected
    ${'@1'}           | ${'@1.2'}         | ${true}
    ${'@1.2'}         | ${'@1.2'}         | ${false}
    ${'@1.2'}         | ${'@1.3'}         | ${false}
    ${'@1.2.3'}       | ${'@1.2'}         | ${false}
    ${'@11.0.10_9'}   | ${'@11.0.10.1_1'} | ${true}
    ${'@11.0.10_9'}   | ${'@11.0.14.1_1'} | ${false}
    ${'@11.0.10_9'}   | ${'@11.0.14_1'}   | ${false}
    ${'@11.0.10.1_9'} | ${'@11.0.10.2_8'} | ${false}
    ${'@11.0.10.2_9'} | ${'@11.0.14_1'}   | ${false}
    ${'@11.0.10.2_9'} | ${'@11.0.14.1_1'} | ${false}
    ${'1.2.3'}        | ${'@latest'}      | ${true}
    ${'@latest'}      | ${'@1'}           | ${false}
    ${'@stable'}      | ${'@latest'}      | ${true}
    ${'@latest'}      | ${'@stable'}      | ${false}
    ${'11.0.10_9'}    | ${'11.0.10.2_1'}  | ${false}
    ${'11.0.10_9'}    | ${'11.0.14.1_1'}  | ${false}
    ${'11.0.10_9'}    | ${'11.0.14_1'}    | ${false}
    ${'11.0.10.1_9'}  | ${'11.0.10.2_8'}  | ${false}
    ${'11.0.10.2_9'}  | ${'11.0.14_1'}    | ${false}
    ${'11.0.10.2_9'}  | ${'11.0.14.1_1'}  | ${false}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.isGreaterThan(version, other)).toBe(expected);
    },
  );

  it.each`
    version           | other             | expected
    ${'@1'}           | ${'@1.2'}         | ${false}
    ${'@1.2'}         | ${'@1.2'}         | ${false}
    ${'@1.2.3'}       | ${'@1.2'}         | ${true}
    ${'@11.0.10_9'}   | ${'@11.0.10.1_1'} | ${false}
    ${'@11.0.10_9'}   | ${'@11.0.14.1_1'} | ${true}
    ${'@11.0.10_9'}   | ${'@11.0.14_1'}   | ${true}
    ${'@11.0.10.1_9'} | ${'@11.0.10.2_8'} | ${true}
    ${'@11.0.10.1_9'} | ${'@11.0.14_1'}   | ${true}
    ${'@11.0.10.1_9'} | ${'@11.0.14.1_1'} | ${true}
    ${'@latest'}      | ${'@1'}           | ${true}
    ${'@stable'}      | ${'@latest'}      | ${false}
    ${'@latest'}      | ${'@stable'}      | ${true}
    ${'11.0.10_9'}    | ${'11.0.10.2_1'}  | ${true}
    ${'11.0.10_9'}    | ${'11.0.14.1_1'}  | ${true}
    ${'11.0.10_9'}    | ${'11.0.14_1'}    | ${true}
    ${'11.0.10.1_9'}  | ${'11.0.10.2_8'}  | ${true}
    ${'11.0.10.2_9'}  | ${'11.0.14_1'}    | ${true}
    ${'11.0.10.2_9'}  | ${'11.0.14.1_1'}  | ${true}
  `(
    'isLessThanRange("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.isLessThanRange(version, other)).toBe(expected);
    },
  );

  it('getSatisfyingVersion', () => {
    expect(versioning.getSatisfyingVersion(['@1.1.1', '1.2.3'], '1.2.3')).toBe(
      '1.2.3',
    );
    expect(
      versioning.getSatisfyingVersion(
        ['1.1.1', '@2.2.1', '2.2.2', '3.3.3'],
        '2.2.2',
      ),
    ).toBe('2.2.2');
    expect(
      versioning.getSatisfyingVersion(
        ['1.1.1', '@1.3.3', '2.2.2', '3.3.3'],
        '1.2.3',
      ),
    ).toBeNull();
  });

  it('minSatisfyingVersion', () => {
    expect(versioning.minSatisfyingVersion(['@1.1.1', '1.2.3'], '1.2.3')).toBe(
      '1.2.3',
    );
    expect(
      versioning.minSatisfyingVersion(
        ['1.1.1', '@1.2.3', '2.2.2', '3.3.3'],
        '2.2.2',
      ),
    ).toBe('2.2.2');
    expect(
      versioning.minSatisfyingVersion(
        ['1.1.1', '@1.2.2', '2.2.2', '3.3.3'],
        '1.2.3',
      ),
    ).toBeNull();
  });

  describe('sortVersions', () => {
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
        ].sort((a, b) => versioning.sortVersions(a, b)),
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
