import maven, { isValid as _isValid } from '.';

const { isValid, isVersion, isStable, getMajor, getMinor, getPatch, matches } =
  maven;

describe('modules/versioning/maven/index', () => {
  it('uses same function module export and api object', () => {
    expect(isValid).toBe(_isValid);
  });

  it.each`
    version              | expected
    ${'1.0.0'}           | ${true}
    ${'17.0.5+8'}        | ${true}
    ${'[1.12.6,1.18.6]'} | ${true}
    ${undefined}         | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!isValid(version)).toBe(expected);
  });

  it.each`
    version              | expected
    ${''}                | ${false}
    ${'1.0.0'}           | ${true}
    ${'0'}               | ${true}
    ${'0.1-2-sp'}        | ${true}
    ${'1-final'}         | ${true}
    ${'1-foo'}           | ${true}
    ${'v1.0.0'}          | ${true}
    ${'x1.0.0'}          | ${true}
    ${'2.1.1.RELEASE'}   | ${true}
    ${'Greenwich.SR1'}   | ${true}
    ${'v1.0.0_2'}        | ${true}
    ${'1.1.1-20_62b10c'} | ${true}
    ${'.1'}              | ${false}
    ${'1.'}              | ${false}
    ${'-1'}              | ${false}
    ${'1-'}              | ${false}
    ${'[1.12.6,1.18.6]'} | ${false}
    ${'RELEASE'}         | ${false}
    ${'release'}         | ${false}
    ${'LATEST'}          | ${false}
    ${'latest'}          | ${false}
    ${'foobar'}          | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!isVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${''}                   | ${false}
    ${'foobar'}             | ${true}
    ${'final'}              | ${true}
    ${'1'}                  | ${true}
    ${'1.2'}                | ${true}
    ${'1.2.3'}              | ${true}
    ${'1.2.3.4'}            | ${true}
    ${'v1.2.3.4'}           | ${true}
    ${'1-alpha-1'}          | ${false}
    ${'1-b1'}               | ${false}
    ${'1-foo'}              | ${true}
    ${'1-final-1.0.0'}      | ${true}
    ${'1-release'}          | ${true}
    ${'1.final'}            | ${true}
    ${'1.0milestone1'}      | ${false}
    ${'1-sp'}               | ${true}
    ${'1-ga-1'}             | ${true}
    ${'1.3-groovy-2.5'}     | ${true}
    ${'1.3-RC1-groovy-2.5'} | ${false}
    ${'Hoxton.RELEASE'}     | ${true}
    ${'Hoxton.SR'}          | ${true}
    ${'Hoxton.SR1'}         | ${true}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = !!isStable(version);
    expect(res).toBe(expected);
  });

  it.each`
    input         | major   | minor   | patch
    ${''}         | ${null} | ${null} | ${null}
    ${'1'}        | ${1}    | ${0}    | ${0}
    ${'1.2'}      | ${1}    | ${2}    | ${0}
    ${'1.2.3'}    | ${1}    | ${2}    | ${3}
    ${'v1.2.3'}   | ${1}    | ${2}    | ${3}
    ${'v1.2.3'}   | ${1}    | ${2}    | ${3}
    ${'1rc42'}    | ${1}    | ${0}    | ${0}
    ${'1-rc42'}   | ${1}    | ${0}    | ${0}
    ${'1-rc42-1'} | ${1}    | ${0}    | ${0}
    ${'1-rc10'}   | ${1}    | ${0}    | ${0}
    ${'1.2.3.4'}  | ${1}    | ${2}    | ${3}
  `(
    '"$input" is represented as [$major, $minor, $patch]',
    ({ input, major, minor, patch }) => {
      expect(getMajor(input)).toBe(major);
      expect(getMinor(input)).toBe(minor);
      expect(getPatch(input)).toBe(patch);
    },
  );

  it.each`
    version          | range                              | expected
    ${'0'}           | ${'[0,1]'}                         | ${true}
    ${'1'}           | ${'[0,1]'}                         | ${true}
    ${'0'}           | ${'(0,1)'}                         | ${false}
    ${'1'}           | ${'(0,1)'}                         | ${false}
    ${'1'}           | ${'(0,2)'}                         | ${true}
    ${'1'}           | ${'[0,2]'}                         | ${true}
    ${'1'}           | ${'(,1]'}                          | ${true}
    ${'1'}           | ${'(,1)'}                          | ${false}
    ${'1'}           | ${'[1,)'}                          | ${true}
    ${'1'}           | ${'(1,)'}                          | ${false}
    ${'1'}           | ${'(,1),(1,)'}                     | ${false}
    ${'1'}           | ${'(0,1),(1,2)'}                   | ${false}
    ${'1.0.0.RC9.2'} | ${'(,1.0.0.RC9.2),(1.0.0.RC9.2,)'} | ${false}
    ${'1.0.0.RC14'}  | ${'(,1.0.0.RC9.2),(1.0.0.RC9.2,)'} | ${true}
    ${'0'}           | ${''}                              | ${false}
    ${'1'}           | ${'1'}                             | ${true}
    ${'1'}           | ${'(1'}                            | ${false}
    ${'2.4.2'}       | ${'2.4.2'}                         | ${true}
    ${'2.4.2'}       | ${'= 2.4.2'}                       | ${false}
    ${'1.2.3'}       | ${'[1,2],[3,4]'}                   | ${true}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(matches(version, range)).toBe(expected);
    },
  );

  it.each`
    a        | b      | expected
    ${'1.1'} | ${'1'} | ${true}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(maven.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    versions | range  | expected
    ${['1']} | ${'1'} | ${'1'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(maven.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions | range  | expected
    ${['1']} | ${'1'} | ${'1'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(maven.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    currentValue             | rangeStrategy | currentVersion | newVersion  | expected
    ${'1'}                   | ${null}       | ${null}        | ${'1.1'}    | ${'1.1'}
    ${'[1.2.3,]'}            | ${null}       | ${null}        | ${'1.2.4'}  | ${'[1.2.3,]'}
    ${'[1.2.3]'}             | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.0.0,1.2.3]'}       | ${'pin'}      | ${'1.0.0'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.0.0,1.2.23]'}      | ${'pin'}      | ${'1.0.0'}     | ${'1.2.23'} | ${'1.2.23'}
    ${'(,1.0]'}              | ${'pin'}      | ${'0.0.1'}     | ${'2.0'}    | ${'2.0'}
    ${'],1.0]'}              | ${'pin'}      | ${'0.0.1'}     | ${'2.0'}    | ${'2.0'}
    ${'(,1.0)'}              | ${'pin'}      | ${'0.1'}       | ${'2.0'}    | ${'2.0'}
    ${'],1.0['}              | ${'pin'}      | ${'2.0'}       | ${'],2.0['} | ${'],2.0['}
    ${'[1.0,1.2],[1.3,1.5)'} | ${'pin'}      | ${'1.0'}       | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.0,1.2],[1.3,1.5['} | ${'pin'}      | ${'1.0'}       | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.2.3,)'}            | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'[1.2.3,['}            | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = maven.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    },
  );
});
