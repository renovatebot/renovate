import nuget from '.';

describe('modules/versioning/nuget/index', () => {
  describe('isSingleVersion()', () => {
    it.each`
      input              | expected
      ${'[1.2.3]'}       | ${true}
      ${'1.2.3'}         | ${false}
      ${'[1.2.3,1.2.3]'} | ${false}
      ${'[1.2.3,1.2.4]'} | ${false}
    `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isSingleVersion(input)).toBe(expected);
    });
  });

  describe('isStable()', () => {
    it.each`
      input                        | expected
      ${'9.0.3'}                   | ${true}
      ${'1.2019.3.22'}             | ${true}
      ${'3.0.0-beta'}              | ${false}
      ${'2.0.2-pre20191018090318'} | ${false}
      ${'1.0.0+c30d7625'}          | ${true}
      ${'2.3.4-beta+1990ef74'}     | ${false}
      ${'[1.2.3]'}                 | ${true}
      ${'[1.2.3-beta]'}            | ${false}
      ${'*'}                       | ${false}
      ${'1.0.*'}                   | ${false}
      ${'1.0.*-*'}                 | ${false}
    `('isStable("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isStable(input)).toBe(expected);
    });
  });

  describe('isValid()', () => {
    it.each`
      input                        | expected
      ${'9.0.3'}                   | ${true}
      ${'1.2019.3.22'}             | ${true}
      ${'3.0.0-beta'}              | ${true}
      ${'2.0.2-pre20191018090318'} | ${true}
      ${'1.0.0+c30d7625'}          | ${true}
      ${'2.3.4-beta+1990ef74'}     | ${true}
      ${'17.04'}                   | ${true}
      ${'3.0.0.beta'}              | ${false}
      ${'5.1.2-+'}                 | ${false}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isValid(input)).toBe(expected);
      expect(nuget.isCompatible(input)).toBe(expected);
    });
  });

  describe('isVersion()', () => {
    it.each`
      input                        | expected
      ${'9.0.3'}                   | ${true}
      ${'1.2019.3.22'}             | ${true}
      ${'3.0.0-beta'}              | ${true}
      ${'2.0.2-pre20191018090318'} | ${true}
      ${'1.0.0+c30d7625'}          | ${true}
      ${'2.3.4-beta+1990ef74'}     | ${true}
      ${'17.04'}                   | ${true}
      ${'3.0.0.beta'}              | ${false}
      ${'5.1.2-+'}                 | ${false}
      ${null}                      | ${false}
      ${undefined}                 | ${false}
    `('isVersion("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isVersion(input)).toBe(expected);
    });
  });

  describe('getMajor, getMinor, getPatch', () => {
    it.each`
      input        | major   | minor   | patch
      ${''}        | ${null} | ${null} | ${null}
      ${null}      | ${null} | ${null} | ${null}
      ${undefined} | ${null} | ${null} | ${null}
      ${'1'}       | ${1}    | ${0}    | ${0}
      ${'1.2'}     | ${1}    | ${2}    | ${0}
      ${'1.2.3'}   | ${1}    | ${2}    | ${3}
      ${'1.2.3.4'} | ${1}    | ${2}    | ${3}
    `(
      '$input -> [$major, $minor, $patch]',
      ({ input, major, minor, patch }) => {
        expect(nuget.getMajor(input)).toBe(major);
        expect(nuget.getMinor(input)).toBe(minor);
        expect(nuget.getPatch(input)).toBe(patch);
      },
    );
  });

  describe('equals()', () => {
    it.each`
      a            | b                   | expected
      ${'17.4'}    | ${'17.04'}          | ${true}
      ${'1.4'}     | ${'1.4.0'}          | ${true}
      ${'1.0.110'} | ${'1.0.110.0'}      | ${true}
      ${'1.0.0'}   | ${'1.0.0+c30d7625'} | ${true}
      ${'foo'}     | ${'bar'}            | ${false}
    `('equals($a, $b) === $expected', ({ a, b, expected }) => {
      expect(nuget.equals(a, b)).toBe(expected);
    });
  });

  describe('isGreaterThan()', () => {
    it.each`
      a                   | b                  | expected
      ${'2.4.2'}          | ${'2.4.1'}         | ${true}
      ${'2.4-beta'}       | ${'2.4-alpha'}     | ${true}
      ${'1.9'}            | ${'2'}             | ${false}
      ${'1.9'}            | ${'1.9.1'}         | ${false}
      ${'2.4.0'}          | ${'2.4.0-beta'}    | ${true}
      ${'2.4.0-alpha'}    | ${'2.4.0'}         | ${false}
      ${'1.2.0-beta.333'} | ${'1.2.0-beta.66'} | ${true}
      ${'1.2.0-beta2'}    | ${'1.2.0-beta10'}  | ${true}
      ${'1.2.0.1'}        | ${'1.2.0'}         | ${true}
      ${'1.2.0.1'}        | ${'1.2.0.1-beta'}  | ${true}
      ${'1.2.0.1-beta'}   | ${'1.2.0.1'}       | ${false}
      ${'1.2.0+1'}        | ${'1.2.0'}         | ${false}
      ${'1.2.0'}          | ${'1.2.0+1'}       | ${false}
      ${'1-a'}            | ${'1-0'}           | ${true}
      ${'foo'}            | ${'bar'}           | ${false}
      ${'bar'}            | ${'foo'}           | ${false}
    `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
      expect(nuget.isGreaterThan(a, b)).toBe(expected);
    });
  });

  describe('isLessThanRange()', () => {
    it.each`
      version         | range          | expected
      ${'foo'}        | ${'bar'}       | ${false}
      ${'1'}          | ${'1'}         | ${false}
      ${'1'}          | ${'2'}         | ${true}
      ${'2'}          | ${'1'}         | ${false}
      ${'1.2.3'}      | ${'[1.2.3]'}   | ${false}
      ${'1.2.3'}      | ${'[1.2.4]'}   | ${true}
      ${'1.2.3'}      | ${'[1.2.2]'}   | ${false}
      ${'1'}          | ${'(1,)'}      | ${true}
      ${'1'}          | ${'[1,)'}      | ${false}
      ${'1'}          | ${'(1,2]'}     | ${true}
      ${'1'}          | ${'[1,2]'}     | ${false}
      ${'1'}          | ${'(,1)'}      | ${false}
      ${'1'}          | ${'(,1]'}      | ${false}
      ${'1'}          | ${'(,2)'}      | ${false}
      ${'1'}          | ${'(,2]'}      | ${false}
      ${'1'}          | ${'*'}         | ${false}
      ${'0'}          | ${'1.*'}       | ${true}
      ${'2'}          | ${'1.*'}       | ${false}
      ${'1-beta'}     | ${'*'}         | ${false}
      ${'1-beta'}     | ${'1.*'}       | ${true}
      ${'1'}          | ${'1.*'}       | ${false}
      ${'1-beta'}     | ${'1.*-*'}     | ${false}
      ${'1.2-beta'}   | ${'1.2.*'}     | ${true}
      ${'1.2'}        | ${'1.2.*'}     | ${false}
      ${'1.2-beta'}   | ${'1.2.*-*'}   | ${false}
      ${'1.2.3-beta'} | ${'1.2.3.*'}   | ${true}
      ${'1.2.3'}      | ${'1.2.3.*'}   | ${false}
      ${'1.2.3-beta'} | ${'1.2.3.*-*'} | ${false}
    `(
      'isLessThanRange("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(nuget.isLessThanRange?.(version, range)).toBe(expected);
      },
    );
  });

  describe('getSatisfyingVersion()', () => {
    it.each`
      versions                              | range       | expected
      ${[]}                                 | ${'[1,2)'}  | ${null}
      ${['foobar']}                         | ${'[1,2)'}  | ${null}
      ${['1', '2', '3']}                    | ${'foobar'} | ${null}
      ${['0.1', '1', '1.1', '2-beta', '2']} | ${'[1,2)'}  | ${'2-beta'}
    `(
      'getSatisfyingVersion($versions, $range) === $expected',
      ({ versions, range, expected }) => {
        expect(nuget.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('minSatisfyingVersion()', () => {
    it.each`
      versions                                        | range       | expected
      ${[]}                                           | ${'[1,2)'}  | ${null}
      ${['foobar']}                                   | ${'[1,2)'}  | ${null}
      ${['1', '2', '3']}                              | ${'foobar'} | ${null}
      ${['0.1', '1-beta', '1', '1.1', '2-beta', '2']} | ${'[1,2)'}  | ${'1'}
    `(
      'minSatisfyingVersion($versions, $range) === $expected',
      ({ versions, range, expected }) => {
        expect(nuget.minSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('getNewValue()', () => {
    it.each`
      currentValue | rangeStrategy | currentVersion | newVersion | isReplacement | expected
      ${'1.0.0'}   | ${'replace'}  | ${'1.0.0'}     | ${null}    | ${false}      | ${null}
      ${'1.0.0'}   | ${'replace'}  | ${'1.0.0'}     | ${'2.0.0'} | ${false}      | ${'2.0.0'}
    `(
      '$rangeStrategy: currentValue=$currentValue currentVersion=$currentVersion newVersion=$newVersion isReplacement=$isReplacement -> $expected',
      ({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
        isReplacement,
        expected,
      }) => {
        expect(
          nuget.getNewValue({
            currentValue,
            rangeStrategy,
            currentVersion,
            newVersion,
            isReplacement,
          }),
        ).toBe(expected);
      },
    );
  });

  describe('sortVersions', () => {
    it.each`
      a            | b            | expected
      ${'1'}       | ${'1'}       | ${0}
      ${'1'}       | ${'2'}       | ${-1}
      ${'2'}       | ${'1'}       | ${1}
      ${'0.1'}     | ${'0.1'}     | ${0}
      ${'0.1'}     | ${'0.2'}     | ${-1}
      ${'0.2'}     | ${'0.1'}     | ${1}
      ${'0.0.1'}   | ${'0.0.1'}   | ${0}
      ${'0.0.1'}   | ${'0.0.2'}   | ${-1}
      ${'0.0.2'}   | ${'0.0.1'}   | ${1}
      ${'0.0.0.1'} | ${'0.0.0.1'} | ${0}
      ${'0.0.0.1'} | ${'0.0.0.2'} | ${-1}
      ${'0.0.0.2'} | ${'0.0.0.1'} | ${1}
      ${'1-abc'}   | ${'1-ABC'}   | ${0}
      ${'1-ABC'}   | ${'1-abc'}   | ${0}
      ${'1-abc'}   | ${'1-xyz'}   | ${-1}
      ${'1-xyz'}   | ${'1-abc'}   | ${1}
      ${'foo'}     | ${'bar'}     | ${0}
    `('sortVersions($a, $b) === $expected', ({ a, b, expected }) => {
      expect(nuget.sortVersions(a, b)).toBe(expected);
    });
  });

  describe('matches()', () => {
    it.each`
      version           | range          | expected
      ${'foo'}          | ${'1'}         | ${false}
      ${'1'}            | ${'foo'}       | ${false}
      ${'1'}            | ${'1'}         | ${true}
      ${'1'}            | ${'2'}         | ${false}
      ${'2'}            | ${'1'}         | ${false}
      ${'1.2.3'}        | ${'[1.2.3]'}   | ${true}
      ${'1.2.3'}        | ${'[1.2.4]'}   | ${false}
      ${'1.2.3'}        | ${'[1.2.2]'}   | ${false}
      ${'1'}            | ${'(1,)'}      | ${false}
      ${'1'}            | ${'[1,)'}      | ${true}
      ${'1'}            | ${'(1,2]'}     | ${false}
      ${'1'}            | ${'[1,2]'}     | ${true}
      ${'1'}            | ${'(1,2)'}     | ${false}
      ${'1'}            | ${'[1,2)'}     | ${true}
      ${'2'}            | ${'(1,2]'}     | ${true}
      ${'2'}            | ${'[1,2]'}     | ${true}
      ${'2'}            | ${'(1,2)'}     | ${false}
      ${'2'}            | ${'[1,2)'}     | ${false}
      ${'1'}            | ${'(,1)'}      | ${false}
      ${'1'}            | ${'(,1]'}      | ${true}
      ${'1'}            | ${'(,2)'}      | ${true}
      ${'1'}            | ${'(,2]'}      | ${true}
      ${'1'}            | ${'*'}         | ${true}
      ${'0.1'}          | ${'1.*'}       | ${false}
      ${'2'}            | ${'1.*'}       | ${false}
      ${'1-beta'}       | ${'*'}         | ${false}
      ${'1-beta'}       | ${'*-*'}       | ${true}
      ${'1'}            | ${'1.*'}       | ${true}
      ${'1-beta'}       | ${'1.*'}       | ${false}
      ${'1'}            | ${'1.*-*'}     | ${true}
      ${'1-beta'}       | ${'1.*-*'}     | ${true}
      ${'1.2'}          | ${'1.2.*'}     | ${true}
      ${'1.2-beta'}     | ${'1.2.*'}     | ${false}
      ${'1.2'}          | ${'1.2.*-*'}   | ${true}
      ${'1.2-beta'}     | ${'1.2.*-*'}   | ${true}
      ${'1.2.3'}        | ${'1.2.3.*'}   | ${true}
      ${'1.2.3-beta'}   | ${'1.2.3.*'}   | ${false}
      ${'1.2.3'}        | ${'1.2.3.*-*'} | ${true}
      ${'1.2.3-beta'}   | ${'1.2.3.*-*'} | ${true}
      ${'1.2.3.4'}      | ${'1.2.3.*'}   | ${true}
      ${'1.2.3.4-beta'} | ${'1.2.3.*'}   | ${false}
      ${'1.2.3.4'}      | ${'1.2.3.*-*'} | ${true}
      ${'1.2.3.4-beta'} | ${'1.2.3.*-*'} | ${true}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(nuget.matches(version, range)).toBe(expected);
      },
    );
  });
});
