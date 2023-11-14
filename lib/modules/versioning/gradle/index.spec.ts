import { compare, parseMavenBasedRange, parsePrefixRange } from './compare';
import { api } from '.';

describe('modules/versioning/gradle/index', () => {
  it.each`
    a                            | b                            | expected
    ${'1'}                       | ${'1'}                       | ${0}
    ${'a'}                       | ${'a'}                       | ${0}
    ${'1a1'}                     | ${'1.a.1'}                   | ${0}
    ${'1a1'}                     | ${'1-a-1'}                   | ${0}
    ${'1a1'}                     | ${'1_a_1'}                   | ${0}
    ${'1a1'}                     | ${'1+a+1'}                   | ${0}
    ${'1.a.1'}                   | ${'1a1'}                     | ${0}
    ${'1-a-1'}                   | ${'1a1'}                     | ${0}
    ${'1_a_1'}                   | ${'1a1'}                     | ${0}
    ${'1+a+1'}                   | ${'1a1'}                     | ${0}
    ${'1.a.1'}                   | ${'1-a+1'}                   | ${0}
    ${'1-a+1'}                   | ${'1.a-1'}                   | ${0}
    ${'1.a-1'}                   | ${'1a1'}                     | ${0}
    ${'dev'}                     | ${'dev'}                     | ${0}
    ${'rc'}                      | ${'rc'}                      | ${0}
    ${'preview'}                 | ${'preview'}                 | ${0}
    ${'release'}                 | ${'release'}                 | ${0}
    ${'final'}                   | ${'final'}                   | ${0}
    ${'snapshot'}                | ${'SNAPSHOT'}                | ${0}
    ${'SNAPSHOT'}                | ${'snapshot'}                | ${0}
    ${'Hoxton.SR1'}              | ${'Hoxton.sr-1'}             | ${0}
    ${'1.1'}                     | ${'1.2'}                     | ${-1}
    ${'1.a'}                     | ${'1.1'}                     | ${-1}
    ${'1.A'}                     | ${'1.B'}                     | ${-1}
    ${'1.B'}                     | ${'1.a'}                     | ${-1}
    ${'1.a'}                     | ${'1.b'}                     | ${-1}
    ${'1.1'}                     | ${'1.1.0'}                   | ${-1}
    ${'1.1.a'}                   | ${'1.1'}                     | ${-1}
    ${'1.0-dev'}                 | ${'1.0-alpha'}               | ${-1}
    ${'1.0-alpha'}               | ${'1.0-rc'}                  | ${-1}
    ${'1.0-zeta'}                | ${'1.0-rc'}                  | ${-1}
    ${'1.0-rc'}                  | ${'1.0-final'}               | ${-1}
    ${'1.0-final'}               | ${'1.0-ga'}                  | ${-1}
    ${'1.0-ga'}                  | ${'1.0-release'}             | ${-1}
    ${'1.0-rc'}                  | ${'1.0-release'}             | ${-1}
    ${'1.0-final'}               | ${'1.0'}                     | ${-1}
    ${'1.0-alpha'}               | ${'1.0-SNAPSHOT'}            | ${-1}
    ${'1.0-zeta'}                | ${'1.0-SNAPSHOT'}            | ${-1}
    ${'1.0-zeta'}                | ${'1.0-rc'}                  | ${-1}
    ${'1.0-rc'}                  | ${'1.0'}                     | ${-1}
    ${'1.0-preview'}             | ${'1.0'}                     | ${-1}
    ${'1.0'}                     | ${'1.0-20150201.121010-123'} | ${-1}
    ${'1.0-20150201.121010-123'} | ${'1.1'}                     | ${-1}
    ${'Hoxton.RELEASE'}          | ${'Hoxton.SR1'}              | ${-1}
    ${'1.0-release'}             | ${'1.0-sp-1'}                | ${-1}
    ${'1.0-sp-1'}                | ${'1.0-sp-2'}                | ${-1}
    ${'1.2'}                     | ${'1.1'}                     | ${1}
    ${'1.1'}                     | ${'1.1.a'}                   | ${1}
    ${'1.B'}                     | ${'1.A'}                     | ${1}
    ${'1.a'}                     | ${'1.B'}                     | ${1}
    ${'1.b'}                     | ${'1.a'}                     | ${1}
    ${'1.1.0'}                   | ${'1.1'}                     | ${1}
    ${'1.1'}                     | ${'1.a'}                     | ${1}
    ${'1.0-alpha'}               | ${'1.0-dev'}                 | ${1}
    ${'1.0-rc'}                  | ${'1.0-alpha'}               | ${1}
    ${'1.0-rc'}                  | ${'1.0-zeta'}                | ${1}
    ${'1.0-release'}             | ${'1.0-rc'}                  | ${1}
    ${'1.0-final'}               | ${'1.0-rc'}                  | ${1}
    ${'1.0-ga'}                  | ${'1.0-final'}               | ${1}
    ${'1.0-release'}             | ${'1.0-ga'}                  | ${1}
    ${'1.0-release'}             | ${'1.0-final'}               | ${1}
    ${'1.0'}                     | ${'1.0-final'}               | ${1}
    ${'1.0-SNAPSHOT'}            | ${'1.0-alpha'}               | ${1}
    ${'1.0-SNAPSHOT'}            | ${'1.0-zeta'}                | ${1}
    ${'1.0-rc'}                  | ${'1.0-zeta'}                | ${1}
    ${'1.0'}                     | ${'1.0-rc'}                  | ${1}
    ${'1.0'}                     | ${'1.0-preview'}             | ${1}
    ${'1.0-20150201.121010-123'} | ${'1.0'}                     | ${1}
    ${'1.1'}                     | ${'1.0-20150201.121010-123'} | ${1}
    ${'Hoxton.SR1'}              | ${'Hoxton.RELEASE'}          | ${1}
    ${'1.0-sp-1'}                | ${'1.0-release'}             | ${1}
    ${'1.0-sp-2'}                | ${'1.0-sp-1'}                | ${1}
    ${''}                        | ${''}                        | ${0}
  `('compare("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(compare(a, b)).toEqual(expected);
  });

  it.each`
    rangeStr
    ${''}
    ${'1.2.3-SNAPSHOT'}
    ${'1.2..+'}
    ${'1.2.++'}
  `('parsePrefixRange("$rangeStr") is null', ({ rangeStr }) => {
    const range = parsePrefixRange(rangeStr);
    expect(range).toBeNull();
  });

  it.each`
    rangeStr
    ${''}
    ${'1.2.3-SNAPSHOT'}
    ${'[]'}
    ${'('}
    ${'['}
    ${','}
    ${'[1.0'}
    ${'1.0]'}
    ${'[1.0],'}
    ${',[1.0]'}
    ${'[2.0,1.0)'}
    ${'[1.2,1.3],1.4'}
    ${'[1.2,,1.3]'}
    ${'[1,[2,3],4]'}
    ${'[1.3,1.2]'}
  `('parseMavenBasedRange("$rangeStr") is null', ({ rangeStr }) => {
    const range = parseMavenBasedRange(rangeStr);
    expect(range).toBeNull();
  });

  it.each`
    input                | expected
    ${'1.0.0'}           | ${true}
    ${'[1.12.6,1.18.6]'} | ${true}
    ${undefined}         | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    expect(api.isValid(input)).toBe(expected);
  });

  it.each`
    input                        | expected
    ${''}                        | ${false}
    ${'latest.integration'}      | ${false}
    ${'latest.release'}          | ${false}
    ${'latest'}                  | ${false}
    ${'1'}                       | ${true}
    ${'a'}                       | ${true}
    ${'A'}                       | ${true}
    ${'1a1'}                     | ${true}
    ${'1.a.1'}                   | ${true}
    ${'1-a-1'}                   | ${true}
    ${'1_a_1'}                   | ${true}
    ${'1+a+1'}                   | ${true}
    ${'1!a!1'}                   | ${false}
    ${'1.0-20150201.121010-123'} | ${true}
    ${'dev'}                     | ${true}
    ${'rc'}                      | ${true}
    ${'release'}                 | ${true}
    ${'final'}                   | ${true}
    ${'SNAPSHOT'}                | ${true}
    ${'1.2'}                     | ${true}
    ${'1..2'}                    | ${false}
    ${'1++2'}                    | ${false}
    ${'1--2'}                    | ${false}
    ${'1__2'}                    | ${false}
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    expect(api.isVersion(input)).toBe(expected);
  });

  it.each`
    input                                   | expected
    ${''}                                   | ${false}
    ${'latest'}                             | ${false}
    ${'foobar'}                             | ${true}
    ${'final'}                              | ${true}
    ${'1'}                                  | ${true}
    ${'1..2'}                               | ${false}
    ${'1.2'}                                | ${true}
    ${'1.2.3'}                              | ${true}
    ${'1.2.3.4 s'}                          | ${false}
    ${'1.2.3.4'}                            | ${true}
    ${'v1.2.3.4'}                           | ${true}
    ${'1-alpha-1'}                          | ${false}
    ${'1-b1'}                               | ${false}
    ${'1-foo'}                              | ${true}
    ${'1-final-1.0.0'}                      | ${true}
    ${'1-release'}                          | ${true}
    ${'1.final'}                            | ${true}
    ${'1.0milestone1'}                      | ${false}
    ${'1-sp'}                               | ${true}
    ${'1-ga-1'}                             | ${true}
    ${'1.3-groovy-2.5'}                     | ${true}
    ${'1.3-RC1-groovy-2.5'}                 | ${false}
    ${'1-preview'}                          | ${false}
    ${'Hoxton.RELEASE'}                     | ${true}
    ${'Hoxton.SR'}                          | ${true}
    ${'Hoxton.SR1'}                         | ${true}
    ${'1.3.5-native-mt-1.3.71-release-429'} | ${false}
    ${'1.0-dev'}                            | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(api.isStable(input)).toBe(expected);
  });

  it.each`
    input         | major   | minor   | patch
    ${''}         | ${null} | ${null} | ${null}
    ${'1'}        | ${1}    | ${0}    | ${0}
    ${'1.2'}      | ${1}    | ${2}    | ${0}
    ${'1.2.3'}    | ${1}    | ${2}    | ${3}
    ${'v1.2.3'}   | ${1}    | ${2}    | ${3}
    ${'1.2.3.4'}  | ${1}    | ${2}    | ${3}
    ${'1rc42'}    | ${1}    | ${0}    | ${0}
    ${'1-rc10'}   | ${1}    | ${0}    | ${0}
    ${'1-rc42'}   | ${1}    | ${0}    | ${0}
    ${'1-rc42-1'} | ${1}    | ${0}    | ${0}
  `(
    '"$input" is represented as [$major, $minor, $patch]',
    ({ input, major, minor, patch }) => {
      expect(api.getMajor(input)).toBe(major);
      expect(api.getMinor(input)).toBe(minor);
      expect(api.getPatch(input)).toBe(patch);
    },
  );

  it.each`
    version          | range      | expected
    ${'1'}           | ${'[[]]'}  | ${false}
    ${'0'}           | ${'[0,1]'} | ${true}
    ${'1'}           | ${'[0,1]'} | ${true}
    ${'0'}           | ${'(0,1)'} | ${false}
    ${'1'}           | ${'(0,1)'} | ${false}
    ${'1'}           | ${'(0,2)'} | ${true}
    ${'1'}           | ${'[0,2]'} | ${true}
    ${'1'}           | ${'(,1]'}  | ${true}
    ${'1'}           | ${'(,1)'}  | ${false}
    ${'1'}           | ${'[1,)'}  | ${true}
    ${'1'}           | ${'(1,)'}  | ${false}
    ${'0'}           | ${''}      | ${false}
    ${'1'}           | ${'1'}     | ${true}
    ${'1.2.3'}       | ${'1.2.+'} | ${true}
    ${'1.2.3.4'}     | ${'1.2.+'} | ${true}
    ${'1.3.0'}       | ${'1.2.+'} | ${false}
    ${'foo'}         | ${'+'}     | ${true}
    ${'1'}           | ${'+'}     | ${true}
    ${'99999999999'} | ${'+'}     | ${true}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(api.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    a        | b      | expected
    ${'1.1'} | ${'1'} | ${true}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(api.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    versions                  | range    | expected
    ${['0', '1.5', '1', '2']} | ${'1.+'} | ${'1'}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(api.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                  | range    | expected
    ${['0', '1', '1.5', '2']} | ${'1.+'} | ${'1.5'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(api.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    currentValue             | rangeStrategy | currentVersion | newVersion  | expected
    ${'1'}                   | ${null}       | ${null}        | ${'1.1'}    | ${'1.1'}
    ${'[1.2.3,]'}            | ${null}       | ${null}        | ${'1.2.4'}  | ${null}
    ${'+'}                   | ${null}       | ${null}        | ${'1.2.4'}  | ${null}
    ${'1.+'}                 | ${null}       | ${null}        | ${'1.2.4'}  | ${'1.+'}
    ${'1.+'}                 | ${null}       | ${null}        | ${'2.1.2'}  | ${'2.+'}
    ${'1.+'}                 | ${null}       | ${null}        | ${'2'}      | ${'2.+'}
    ${'1.3.+'}               | ${null}       | ${null}        | ${'1.3.4'}  | ${'1.3.+'}
    ${'1.3.+'}               | ${null}       | ${null}        | ${'1.5.2'}  | ${'1.5.+'}
    ${'1.3.+'}               | ${null}       | ${null}        | ${'2'}      | ${'2'}
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
      const res = api.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    },
  );
});
