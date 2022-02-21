import { api as pvp } from '.';

describe('versioning/pvp/index', () => {
  test.each`
    version                                          | isValid
    ${'0.1.0'}                                       | ${true}
    ${'1.0.0'}                                       | ${true}
    ${'0.0.1'}                                       | ${true}
    ${'1.1.0.1.5.123455'}                            | ${true}
    ${'1.2.3'}                                       | ${true}
    ${'1.02.3'}                                      | ${false}
    ${'1.04'}                                        | ${false}
    ${'1.2.3-foo'}                                   | ${false}
    ${'1.2.3foo'}                                    | ${false}
    ${'~1.2.3'}                                      | ${false}
    ${'^1.2.3'}                                      | ${false}
    ${'>1.2.3'}                                      | ${false}
    ${'one.two.three'}                               | ${false}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#main'}                   | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
  `('isValid("$version") === $isValid', ({ version, isValid }) => {
    const res = pvp.isValid(version);
    expect(res).toBe(isValid);
  });

  test.each`
    input                        | expected
    ${'9.0.3'}                   | ${true}
    ${'1.2019.3.22'}             | ${true}
    ${'3.0.0-beta'}              | ${false}
    ${'2.0.2-pre20191018090318'} | ${false}
    ${'1.0.0+c30d7625'}          | ${false}
    ${'2.3.4-beta+1990ef74'}     | ${false}
    ${'17.04'}                   | ${false}
    ${'3.0.0.beta'}              | ${false}
    ${'5.1.2-+'}                 | ${false}
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    const res = !!pvp.isVersion(input);
    expect(res).toBe(expected);
  });

  test.each`
    input                        | expected
    ${'9.0.3'}                   | ${true}
    ${'1.2019.3.22'}             | ${true}
    ${'3.0.0-beta'}              | ${false}
    ${'2.0.2-pre20191018090318'} | ${false}
    ${'1.0.0+c30d7625'}          | ${false}
    ${'2.3.4-beta+1990ef74'}     | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(pvp.isStable(input)).toBe(expected);
  });

  test.each`
    a            | b              | expected
    ${'17.4.0'}  | ${'17.4.0'}    | ${true}
    ${'1.4'}     | ${'1.4.0'}     | ${false}
    ${'1.0.110'} | ${'1.0.110.0'} | ${false}
    ${'1.0.0'}   | ${'1.0.0'}     | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(pvp.equals(a, b)).toBe(expected);
  });

  test.each`
    a          | b          | expected
    ${'2.4.2'} | ${'2.4.1'} | ${true}
    ${'1.9.0'} | ${'2.0.0'} | ${false}
    ${'1.9.0'} | ${'1.9.1'} | ${false}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(pvp.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    input      | expected
    ${'1.2.3'} | ${1.2}
    ${'1.0.2'} | ${1}
  `('getMajor("$input") === $expected', ({ input, expected }) => {
    expect(pvp.getMajor(input)).toBe(expected);
  });

  test.each`
    input      | expected
    ${'1.2.3'} | ${3}
    ${'1.0.0'} | ${0}
  `('getMinor("$input") === $expected', ({ input, expected }) => {
    expect(pvp.getMinor(input)).toBe(expected);
  });

  test.each`
    input        | expected
    ${'1.2.3.4'} | ${4}
    ${'1.0.2'}   | ${undefined}
  `('getPatch("$input") === $expected', ({ input, expected }) => {
    expect(pvp.getPatch(input)).toBe(expected);
  });
});
