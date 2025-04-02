import { api } from '.';

describe('modules/versioning/conda/index', () => {
  it.each`
    input                                            | expected
    ${'0.750'}                                       | ${true}
    ${'1.2.3'}                                       | ${true}
    ${'1.0.1a'}                                      | ${true}
    ${'1.9'}                                         | ${true}
    ${'17.04.0'}                                     | ${true}
    ${''}                                            | ${false}
    ${'==1.2.3'}                                     | ${false}
    ${'==1.2.3.0'}                                   | ${false}
    ${'==1.2.3rc0'}                                  | ${false}
    ${'~=1.2.3'}                                     | ${false}
    ${'1.2.*'}                                       | ${false}
    ${'>1.2.3'}                                      | ${false}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#master'}                 | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    const res = !!api.isVersion(input);
    expect(res).toBe(expected);
  });

  it.each`
    input                                            | expected
    ${'0.750'}                                       | ${true}
    ${'1.2.3'}                                       | ${true}
    ${'1.9'}                                         | ${true}
    ${'17.04.0'}                                     | ${true}
    ${'==1.2.3'}                                     | ${true}
    ${'==1.2.3.0'}                                   | ${true}
    ${'==1.2.3rc0'}                                  | ${true}
    ${'~=1.2.3'}                                     | ${true}
    ${'1.2.*'}                                       | ${true}
    ${'>1.2.3'}                                      | ${true}
    ${''}                                            | ${false}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#master'}                 | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!api.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    input                | expected
    ${'1.2.3'}           | ${true}
    ${'1.2.3rc0'}        | ${true}
    ${'1.2.3a'}          | ${true}
    ${'not./version..1'} | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(api.isStable(input)).toBe(expected);
  });

  it.each`
    a                   | b                   | expected
    ${'1.0'}            | ${'1.0.0'}          | ${true}
    ${'1.0.0'}          | ${'1.0.foo'}        | ${false}
    ${'non-pep440-1'}   | ${'non-pep440-2'}   | ${false}
    ${'broken/version'} | ${'broken/version'} | ${false}
    ${'1.0.0'}          | ${'broken/version'} | ${false}
    ${'broken/version'} | ${'1.0.0'}          | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(api.equals(a, b)).toBe(expected);
  });

  it.each`
    a                       | b             | expected
    ${'1.0'}                | ${'>=1.0.0'}  | ${true}
    ${'3.0.0'}              | ${'==3.0.0'}  | ${true}
    ${'1.6.2'}              | ${'<2.2.1.0'} | ${true}
    ${'3.8'}                | ${'>=3.9'}    | ${false}
    ${'not-pep440-version'} | ${'*'}        | ${true}
    ${'not/conda/version'}  | ${'*'}        | ${false}
    ${'not/conda/version'}  | ${''}         | ${false}
  `('matches("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(api.matches(a, b)).toBe(expected);
  });

  it.each`
    a                       | expected
    ${'1.0'}                | ${1}
    ${'3.0.0'}              | ${3}
    ${'1.6.2'}              | ${1}
    ${'3.8'}                | ${3}
    ${'not-pep440-version'} | ${null}
  `('getMajor("$a") === $expected', ({ a, expected }) => {
    expect(api.getMajor(a)).toBe(expected);
  });

  it.each`
    a                      | expected
    ${'1.0'}               | ${0}
    ${'3.0.0'}             | ${0}
    ${'1.6.2'}             | ${6}
    ${'3.8'}               | ${8}
    ${'1!3.8'}             | ${8}
    ${'non-pep440-string'} | ${null}
  `('getMinor($a) === $expected', ({ a, expected }) => {
    expect(api.getMinor(a)).toBe(expected);
  });

  it.each`
    a                       | expected
    ${'1.0'}                | ${0}
    ${'3.0.0'}              | ${0}
    ${'1.6.2'}              | ${2}
    ${'3.8'}                | ${0}
    ${'not-pep440-version'} | ${null}
  `('getPatch("$a") === $expected', ({ a, expected }) => {
    expect(api.getPatch(a)).toBe(expected);
  });

  it.each`
    version         | isSingle
    ${'==1.2.3'}    | ${true}
    ${'==1.2.3rc0'} | ${true}
    ${'==1.2.3'}    | ${true}
    ${'==1.2'}      | ${true}
    ${'== 1.2.3'}   | ${true}
    ${'==1.*'}      | ${false}
    ${'*'}          | ${false}
    ${'>=1.0'}      | ${false}
  `('isSingleVersion("$version") === $isSingle', ({ version, isSingle }) => {
    const res = !!api.isSingleVersion(version);
    expect(res).toBe(isSingle);
  });

  it('always compatible', () => {
    expect(api.isCompatible('a', 'b')).toBeTrue();
  });

  const versions = [
    '0.9.4',
    '1.0.0',
    '1.1.5',
    '1.2.1',
    '1.2.2',
    '1.2.3',
    '1.3.4',
    '2.0.3',
  ];

  it.each`
    range        | expected
    ${'~=1.2.1'} | ${'1.2.3'}
    ${'~=2.1'}   | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ range, expected }) => {
      expect(api.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    range        | expected
    ${'~=1.2.1'} | ${'1.2.1'}
    ${'~=2.1'}   | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ range, expected }) => {
      expect(api.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    a            | b          | result
    ${'1.2.1'}   | ${'1.2.0'} | ${true}
    ${'1!1.0.0'} | ${'3.1.2'} | ${true}
  `('isGreaterThan("$a", "$b") === $result', ({ a, b, result }) => {
    expect(api.isGreaterThan(a, b)).toBe(result);
  });

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion | expected
    ${'*'}       | ${'pin'}      | ${'1.0.0'}     | ${'1.2.3'} | ${'==1.2.3'}
    ${'*'}       | ${'bump'}     | ${'1.0.0'}     | ${'1.2.3'} | ${'>=1.2.3'}
    ${'*'}       | ${'widen'}    | ${'1.0.0'}     | ${'1.2.3'} | ${null}
    ${'*'}       | ${'widen'}    | ${'1.0.0'}     | ${'1.2.3'} | ${null}
    ${'<2.0.0'}  | ${'pin'}      | ${'1.0.0'}     | ${'1.2.3'} | ${'==1.2.3'}
    ${'1.0.*'}   | ${'pin'}      | ${'1.0.0'}     | ${'1.2.3'} | ${'==1.2.3'}
    ${'1.0.*'}   | ${'bump'}     | ${'1.0.0'}     | ${'1.2.3'} | ${'1.2.*'}
    ${'1.2.*'}   | ${'widen'}    | ${'1.0.0'}     | ${'1.2.3'} | ${'1.2.*'}
    ${'>=1.0.0'} | ${'bump'}     | ${'1.0.0'}     | ${'1.2.3'} | ${'>=1.2.3'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = api.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    },
  );
});
