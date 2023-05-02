import deb from '.';

describe('modules/versioning/deb/index', () => {
  it.each`
    version                                        | expected
    ${'1.1'}                                       | ${true}
    ${'1.3.RC2'}                                   | ${true}
    ${'0:1.1-1'}                                   | ${true}
    ${'a:1.1-1'}                                   | ${false}
    ${'1.1:1.3-1'}                                 | ${false}
    ${'1.1a:1.3-1'}                                | ${false}
    ${'1a:1.3-1'}                                  | ${false}
    ${'-1:1.3-1'}                                  | ${false}
    ${'1:1:1:2-1'}                                 | ${true}
    ${'1:a:b:c:2-1'}                               | ${true}
    ${'1:3_3.2-1'}                                 | ${false}
    ${'1:3!3.2-1'}                                 | ${false}
    ${'1:3/3.2-1'}                                 | ${false}
    ${'1.0-3_2'}                                   | ${false}
    ${'1.0-3!3'}                                   | ${false}
    ${'1.0-3/3'}                                   | ${false}
    ${'1.0+ä1-1'}                                  | ${false}
    ${'1,0-1'}                                     | ${false}
    ${'2:1.1-1'}                                   | ${true}
    ${'1.1.1-0debian1'}                            | ${true}
    ${'1.1.1+really1.1.2-0debian1'}                | ${true}
    ${'2.31-13+deb11u5'}                           | ${true}
    ${'1:4.14+20190211-1ubuntu1'}                  | ${true}
    ${'2.7.7+dfsg-12'}                             | ${true}
    ${'9.5.0-1ubuntu1~22.04'}                      | ${true}
    ${'5:20.10.17~3-0~ubuntu-focal'}               | ${true}
    ${'1:6.0.1r16-1.1build1'}                      | ${true}
    ${'2:102.12+LibO7.3.7-0ubuntu0.22.04.1'}       | ${true}
    ${'1:2.20.1-1~bpo9+1'}                         | ${true}
    ${'v1.4'}                                      | ${true}
    ${'3.5.0'}                                     | ${true}
    ${'4.2.21.Final'}                              | ${true}
    ${'0.6.5.1'}                                   | ${true}
    ${'20100527'}                                  | ${true}
    ${'2.1.0-M3'}                                  | ${true}
    ${'4.3.20.RELEASE'}                            | ${true}
    ${'1.1-groovy-2.4'}                            | ${true}
    ${'0.8a'}                                      | ${true}
    ${'3.1.0.GA'}                                  | ${true}
    ${'3.0.0-beta.3'}                              | ${true}
    ${'foo'}                                       | ${true}
    ${'1.2.3.4.5.6.7'}                             | ${true}
    ${'0a1b2c3'}                                   | ${true}
    ${'0a1b2c3d'}                                  | ${true}
    ${'0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d'}  | ${true}
    ${'0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0'} | ${true}
    ${'0a1b2C3'}                                   | ${true}
    ${'0z1b2c3'}                                   | ${true}
    ${'0A1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d'}  | ${true}
    ${'123098140293'}                              | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(deb.isValid(version)).toBe(expected);
  });

  it.each`
    a                         | b                         | expected
    ${'2.4'}                  | ${'2.4'}                  | ${true}
    ${'2.4.0'}                | ${'2.4.0'}                | ${true}
    ${'2.4.0'}                | ${'2.4'}                  | ${false}
    ${'2.4.1'}                | ${'2.4'}                  | ${false}
    ${'2.4.2'}                | ${'2.4.1'}                | ${false}
    ${'0.8a'}                 | ${'0.8a'}                 | ${true}
    ${'9.5.0-1ubuntu1~22.04'} | ${'9.5.0-1ubuntu1'}       | ${false}
    ${'9.5.0-1ubuntu1~22.04'} | ${'9.5.0-1ubuntu1~20.04'} | ${false}
    ${'9.5.0-1ubuntu1~22.04'} | ${'9.5.0-1ubuntu1~22.04'} | ${true}
    ${'2.31-13+deb11u5'}      | ${'2.31-13+deb11u5'}      | ${true}
    ${'2.31-13+deb11u5'}      | ${'2.31-13+deb11u4'}      | ${false}
    ${'1.4-'}                 | ${'1.4'}                  | ${false}
    ${'v1.4'}                 | ${'1.4'}                  | ${false}
    ${'0:1.4'}                | ${'1.4'}                  | ${true}
    ${'1:1.4'}                | ${'1.4'}                  | ${false}
    ${'1.4-1'}                | ${'1.4-2'}                | ${false}
    ${'0:1.4'}                | ${'a:1.4'}                | ${false}
    ${'a:1.4'}                | ${'0:1.4'}                | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(deb.equals(a, b)).toBe(expected);
  });

  it.each`
    a                    | b                    | expected
    ${'2.4.0'}           | ${'2.4'}             | ${true}
    ${'2.4.2'}           | ${'2.4.1'}           | ${true}
    ${'2.4.beta'}        | ${'2.4.alpha'}       | ${true}
    ${'1.9'}             | ${'2'}               | ${false}
    ${'1.9'}             | ${'1.9.1'}           | ${false}
    ${'2.4'}             | ${'2.4.beta'}        | ${false}
    ${'2.4.0'}           | ${'2.4.beta'}        | ${false}
    ${'2.4.beta'}        | ${'2.4'}             | ${true}
    ${'2.4.beta'}        | ${'2.4.0'}           | ${true}
    ${'2.4~'}            | ${'2.4~~'}           | ${true}
    ${'2.4'}             | ${'2.4~'}            | ${true}
    ${'2.4a'}            | ${'2.4'}             | ${true}
    ${'2.31-13+deb11u5'} | ${'2.31-9'}          | ${true}
    ${'2.31-13+deb11u5'} | ${'2.31-13+deb10u5'} | ${true}
    ${'2.31-13+deb11u5'} | ${'2.31-13+deb11u4'} | ${true}
    ${'1.9'}             | ${'1:1.7'}           | ${false}
    ${'1.9'}             | ${'1.12'}            | ${false}
    ${'1.12'}            | ${'1.9'}             | ${true}
    ${'1:1.9'}           | ${'1:1.7'}           | ${true}
    ${'2.4.0.beta1'}     | ${'2.4.0.Beta1'}     | ${true}
    ${'1:1.0'}           | ${'1:1.0~'}          | ${true}
    ${'1:1.0Z0-0'}       | ${'1:1.0'}           | ${true}
    ${'1:1.0Z0-0'}       | ${'1:1.0A0-0'}       | ${true}
    ${'1:1.0a0-0'}       | ${'1:1.0Z0-0'}       | ${true}
    ${'1:1.0z0-0'}       | ${'1:1.0a0-0'}       | ${true}
    ${'1:1.0+0-0'}       | ${'1:1.0z0-0'}       | ${true}
    ${'1:1.0-0-0'}       | ${'1:1.0+0-0'}       | ${true}
    ${'1:1.0.0-0'}       | ${'1:1.0-0-0'}       | ${true}
    ${'1:1.0:0-0'}       | ${'1:1.0.0-0'}       | ${true}
    ${'a:1.4'}           | ${'0:1.4'}           | ${true}
    ${'0:1.4'}           | ${'a:1.4'}           | ${true}
    ${'a:1.4'}           | ${'a:1.4'}           | ${true}
    ${'a1'}              | ${'a~'}              | ${true}
    ${'a0'}              | ${'a~'}              | ${true}
    ${'aa'}              | ${'a1'}              | ${true}
    ${'ab'}              | ${'a0'}              | ${true}
    ${'10'}              | ${'1.'}              | ${true}
    ${'10'}              | ${'1a'}              | ${true}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(deb.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    version     | expected
    ${'1.2.0'}  | ${true}
    ${'^1.2.0'} | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(deb.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    version              | expected
    ${'v1.3.0'}          | ${1}
    ${'2-0-1'}           | ${2}
    ${'2.31-13+deb11u5'} | ${2}
    ${'1:2.3.1'}         | ${2}
    ${'foo'}             | ${null}
    ${'8'}               | ${8}
    ${'1.0'}             | ${1}
  `('getMajor("$version") === $expected', ({ version, expected }) => {
    expect(deb.getMajor(version)).toBe(expected);
  });

  it.each`
    version              | expected
    ${'v1.3.0'}          | ${3}
    ${'2-0-1'}           | ${0}
    ${'2.31-13+deb11u5'} | ${31}
    ${'1:2.3.1'}         | ${3}
    ${'foo'}             | ${null}
    ${'8'}               | ${null}
    ${'1.0'}             | ${0}
  `('getMinor("$version") === $expected', ({ version, expected }) => {
    expect(deb.getMinor(version)).toBe(expected);
  });

  it.each`
    version              | expected
    ${'v1.3.0'}          | ${0}
    ${'2-0-1'}           | ${1}
    ${'2.31-13+deb11u5'} | ${13}
    ${'1:2.3.1'}         | ${1}
    ${'foo'}             | ${null}
    ${'8'}               | ${null}
    ${'1.0'}             | ${null}
  `('getPatch("$version") === $expected', ({ version, expected }) => {
    expect(deb.getPatch(version)).toBe(expected);
  });
});
