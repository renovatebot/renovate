import maven, { isValid as _isValid } from './index.ts';

const { isValid, isVersion, isStable, getMajor, getMinor, getPatch, matches } =
  maven;

describe('modules/versioning/maven/index', () => {
  it('uses same function module export and api object', () => {
    expect(isValid).toBe(_isValid);
  });

  it.each`
    version                  | expected
    ${'1.0.0'}               | ${true}
    ${'[1.0.0]'}             | ${true}
    ${'17.0.5+8'}            | ${true}
    ${'[1.12.6,1.18.6]'}     | ${true}
    ${'(,1.0]'}              | ${true}
    ${'[1.0,)'}              | ${true}
    ${'[1.0,2.0)'}           | ${true}
    ${'(1.0,2.0]'}           | ${true}
    ${'],1.0]'}              | ${true}
    ${'[1.0,['}              | ${true}
    ${'[1.0,2.0],[3.0,4.0)'} | ${true}
    ${undefined}             | ${false}
    ${'[,1.0]'}              | ${false}
    ${'[1.0,]'}              | ${false}
    ${'[2.0,1.0)'}           | ${false}
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
    ${'1.2.3'}       | ${'[1.2.3]'}                       | ${true}
    ${'1.2.3'}       | ${'[1.2.4]'}                       | ${false}
    ${'1.0'}         | ${'[1.0,2.0)'}                     | ${true}
    ${'2.0'}         | ${'[1.0,2.0)'}                     | ${false}
    ${'1.5'}         | ${'[1.0,2.0)'}                     | ${true}
    ${'0.9'}         | ${'[1.0,2.0)'}                     | ${false}
    ${'1.0'}         | ${'(1.0,2.0]'}                     | ${false}
    ${'2.0'}         | ${'(1.0,2.0]'}                     | ${true}
    ${'1.5'}         | ${'(1.0,2.0]'}                     | ${true}
    ${'0'}           | ${']0,2]'}                         | ${false}
    ${'1'}           | ${']0,2]'}                         | ${true}
    ${'2'}           | ${']0,2]'}                         | ${true}
    ${'0'}           | ${']0,2['}                         | ${false}
    ${'1'}           | ${']0,2['}                         | ${true}
    ${'2'}           | ${']0,2['}                         | ${false}
    ${'1'}           | ${'[1,2['}                         | ${true}
    ${'2'}           | ${'[1,2['}                         | ${false}
    ${'0'}           | ${'[1,2['}                         | ${false}
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
    versions               | range          | expected
    ${['1']}               | ${'1'}         | ${'1'}
    ${['1', '2', '3']}     | ${'[1,2]'}     | ${'2'}
    ${['1', '2', '3']}     | ${'[1,)'}      | ${'3'}
    ${['1', '2', '3']}     | ${'[4,)'}      | ${null}
    ${['1.0', '1.1', '2']} | ${'[1.0,2.0)'} | ${'1.1'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(maven.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions               | range          | expected
    ${['1']}               | ${'1'}         | ${'1'}
    ${['1', '2', '3']}     | ${'[1,2]'}     | ${'2'}
    ${['1', '2', '3']}     | ${'[1,)'}      | ${'3'}
    ${['1', '2', '3']}     | ${'[4,)'}      | ${null}
    ${['1.0', '1.1', '2']} | ${'[1.0,2.0)'} | ${'1.1'}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(maven.minSatisfyingVersion(versions, range)).toBe(expected);
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
    ${'[1.0.0,1.2.3]'}       | ${'widen'}    | ${'1.0.0'}     | ${'1.2.4'}  | ${'[1.0.0,1.2.4]'}
    ${'[1.0.0,1.2.3]'}       | ${'bump'}     | ${'1.0.0'}     | ${'1.2.4'}  | ${'[1.0.0,1.2.4]'}
    ${'[1.0.0,1.2.3]'}       | ${'replace'}  | ${'1.0.0'}     | ${'1.2.4'}  | ${'[1.0.0,1.2.4]'}
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

  describe('range constraints for Jenkins-style version numbers', () => {
    describe('>=2.164.0 <2.165.0', () => {
      const range = '[2.164.0,2.165.0)';

      it.each`
        version               | expected
        ${'2.164.0'}          | ${true}
        ${'2.164.1'}          | ${true}
        ${'2.164.99'}         | ${true}
        ${'2.165.0'}          | ${false}
        ${'2.163.9'}          | ${false}
        ${'2.164.0-SNAPSHOT'} | ${false}
      `(
        'matches("$version", "' + range + '") === $expected',
        ({ version, expected }) => {
          expect(matches(version, range)).toBe(expected);
        },
      );
    });

    describe('>=2.164.0 <=2.165.0', () => {
      const range = '[2.164.0,2.165.0]';

      it.each`
        version               | expected
        ${'2.164.0'}          | ${true}
        ${'2.164.1'}          | ${true}
        ${'2.164.99'}         | ${true}
        ${'2.165.0'}          | ${true}
        ${'2.163.9'}          | ${false}
        ${'2.164.0-SNAPSHOT'} | ${false}
      `(
        'matches("$version", "' + range + '") === $expected',
        ({ version, expected }) => {
          expect(matches(version, range)).toBe(expected);
        },
      );
    });

    describe('<2.164.0', () => {
      const range = '(,2.164.0)';

      it.each`
        version               | expected
        ${'2.164.0'}          | ${false}
        ${'2.164.1'}          | ${false}
        ${'2.163.9'}          | ${true}
        ${'2.164.0-SNAPSHOT'} | ${true}
        ${'1.0.0'}            | ${true}
      `(
        'matches("$version", "' + range + '") === $expected',
        ({ version, expected }) => {
          expect(matches(version, range)).toBe(expected);
        },
      );
    });
  });
});
