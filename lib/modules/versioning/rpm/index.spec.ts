import rpm from '.';

describe('modules/versioning/rpm/index', () => {
  test.each`
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
    ${'1:3_3.2-1'}                                 | ${true}
    ${'1:3!3.2-1'}                                 | ${true}
    ${'1:3/3.2-1'}                                 | ${true}
    ${'1.0-3_2'}                                   | ${true}
    ${'1.0-3!3'}                                   | ${true}
    ${'1.0-3/3'}                                   | ${true}
    ${'1.0+ä1-1'}                                  | ${true}
    ${'1,0-1'}                                     | ${true}
    ${'2:1.1-1'}                                   | ${true}
    ${'1.1.1-0rpmian1'}                            | ${true}
    ${'1.1.1+really1.1.2-0rpmian1'}                | ${true}
    ${'2.31-13+rpm11u5'}                           | ${true}
    ${'1:0.17.20140318svn632.el7'}                 | ${true}
    ${'2.7.7+dfsg-12'}                             | ${true}
    ${'8.20140605hgacf1c26e3029.el7'}              | ${true}
    ${'5:0.5.20120830CVS.el7'}                     | ${true}
    ${'1:6.0.1r16-1.1build1'}                      | ${true}
    ${'1.el6'}                                     | ${true}
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
    ${'3.12.0-1~a1^20231001'}                      | ${true}
    ${'1.2.3^20231001'}                            | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(rpm.isValid(version)).toBe(expected);
  });

  test.each`
    a                         | b                        | expected
    ${''}                     | ${''}                    | ${true}
    ${'~a'}                   | ${'~~'}                  | ${false}
    ${'~'}                    | ${'~'}                   | ${true}
    ${'~'}                    | ${'1'}                   | ${false}
    ${'1~'}                   | ${'~'}                   | ${false}
    ${'1'}                    | ${'a'}                   | ${false}
    ${'2.4'}                  | ${'2.4'}                 | ${true}
    ${'2.4.~'}                | ${'2.4'}                 | ${false}
    ${'2.4'}                  | ${'2.4.~'}               | ${false}
    ${'2.4.0'}                | ${'2.4.0'}               | ${true}
    ${'2.4.0'}                | ${'2.4'}                 | ${false}
    ${'2.4.1'}                | ${'2.4'}                 | ${false}
    ${'2.4.2'}                | ${'2.4.1'}               | ${false}
    ${'0.8a'}                 | ${'0.8a'}                | ${true}
    ${'90.5.20120830CVS.el6'} | ${'0.5.20120830CVS.el7'} | ${false}
    ${'0.5.20120830CVS.el7'}  | ${'0.5.20120830CVS.el6'} | ${false}
    ${'0.5.20120830CVS.el7'}  | ${'0.5.20120830CVS.el7'} | ${true}
    ${'2.31-13+rpm11u5'}      | ${'2.31-13+rpm11u5'}     | ${true}
    ${'2.31-13+rpm11u5'}      | ${'2.31-13+rpm11u4'}     | ${false}
    ${'1.4-'}                 | ${'1.4'}                 | ${true}
    ${'v1.4'}                 | ${'1.4'}                 | ${false}
    ${'0:1.4'}                | ${'1.4'}                 | ${true}
    ${'1:1.4'}                | ${'1.4'}                 | ${false}
    ${'1.4-1'}                | ${'1.4-2'}               | ${false}
    ${'0:1.4'}                | ${'a:1.4'}               | ${false}
    ${'a:1.4'}                | ${'0:1.4'}               | ${false}
    ${'3.12.0-1~^2023'}       | ${'3.12.0-1^2023'}       | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(rpm.equals(a, b)).toBe(expected);
  });

  test.each`
    a                      | b                      | expected
    ${'2.4.0'}             | ${'2.4'}               | ${true}
    ${'2.4.2'}             | ${'2.4.1'}             | ${true}
    ${'2.4.beta'}          | ${'2.4.alpha'}         | ${true}
    ${'1.9'}               | ${'2'}                 | ${false}
    ${'1.9'}               | ${'1.9.1'}             | ${false}
    ${'2.4'}               | ${'2.4.beta'}          | ${false}
    ${'2.4.0'}             | ${'2.4.beta'}          | ${true}
    ${'2.4.beta'}          | ${'2.4'}               | ${true}
    ${'2.4.beta'}          | ${'2.4.0'}             | ${false}
    ${'2.4~'}              | ${'2.4~~'}             | ${true}
    ${'2.4'}               | ${'2.4~'}              | ${true}
    ${'2.4a'}              | ${'2.4'}               | ${true}
    ${'2.31-13+rpm11u5'}   | ${'2.31-9'}            | ${true}
    ${'2.31-13+rpm11u5'}   | ${'2.31-13+rpm10u5'}   | ${true}
    ${'2.31-13+rpm11u5'}   | ${'2.31-13+rpm11u4'}   | ${true}
    ${'1.9'}               | ${'1:1.7'}             | ${false}
    ${'1.9'}               | ${'1.12'}              | ${false}
    ${'1.12'}              | ${'1.9'}               | ${true}
    ${'1:1.9'}             | ${'1:1.7'}             | ${true}
    ${'2.4.0.beta1'}       | ${'2.4.0.Beta1'}       | ${true}
    ${'1:1.0'}             | ${'1:1.0~'}            | ${true}
    ${'1:1.0Z0-0'}         | ${'1:1.0'}             | ${true}
    ${'1:1.0Z0-0'}         | ${'1:1.0A0-0'}         | ${true}
    ${'1:1.0a0-0'}         | ${'1:1.0Z0-0'}         | ${true}
    ${'1:1.0z0-0'}         | ${'1:1.0a0-0'}         | ${true}
    ${'1:1.0+0-0'}         | ${'1:1.0z0-0'}         | ${true}
    ${'1:1.0-0-0'}         | ${'1:1.0+0-0'}         | ${false}
    ${'1:1.0.0-0'}         | ${'1:1.0-0-0'}         | ${true}
    ${'1:1.0:0-0'}         | ${'1:1.0.0-0'}         | ${false}
    ${'a:1.4'}             | ${'0:1.4'}             | ${true}
    ${'0:1.4'}             | ${'a:1.4'}             | ${true}
    ${'a:1.4'}             | ${'a:1.4'}             | ${true}
    ${'a1'}                | ${'a~'}                | ${true}
    ${'a0'}                | ${'a~'}                | ${true}
    ${'aa'}                | ${'a1'}                | ${true}
    ${'ab'}                | ${'a0'}                | ${true}
    ${'10'}                | ${'1.'}                | ${true}
    ${'10'}                | ${'1a'}                | ${true}
    ${'a'}                 | ${'A'}                 | ${true}
    ${'A'}                 | ${'a'}                 | ${false}
    ${'A1'}                | ${'Aa'}                | ${false}
    ${'aaaaa1'}            | ${'aaaaaaaaaaaa2'}     | ${false}
    ${'a-1~^20231001'}     | ${'a-1^20231001'}      | ${false}
    ${'1'}                 | ${'2'}                 | ${false}
    ${'a-1~pre2^20231001'} | ${'a-1~pre2^20231002'} | ${false}
    ${'a-1'}               | ${'a-1~pre1'}          | ${true}
    ${'4.20-4~beta4'}      | ${'4.20-4'}            | ${false}
    ${'1.2.3~beta2'}       | ${'1.2.3~alpha1'}      | ${true}
    ${'1.2.3-4~alpha1'}    | ${'1.2.3-4~beta2'}     | ${false}
    ${'}}}'}               | ${'{{{'}               | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(rpm.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    version              | expected
    ${'v1.3.0'}          | ${1}
    ${'2-0-1'}           | ${2}
    ${'2.31-13+rpm11u5'} | ${2}
    ${'1:2.3.1'}         | ${2}
    ${'foo'}             | ${null}
    ${'8'}               | ${8}
    ${'1.0'}             | ${1}
  `('getMajor("$version") === $expected', ({ version, expected }) => {
    expect(rpm.getMajor(version)).toBe(expected);
  });

  test.each`
    version              | expected
    ${'v1.3.0'}          | ${3}
    ${'2-0-1'}           | ${0}
    ${'2.31-13+rpm11u5'} | ${31}
    ${'1:2.3.1'}         | ${3}
    ${'foo'}             | ${null}
    ${'8'}               | ${null}
    ${'1.0'}             | ${0}
  `('getMinor("$version") === $expected', ({ version, expected }) => {
    expect(rpm.getMinor(version)).toBe(expected);
  });

  test.each`
    version              | expected
    ${'v1.3.0'}          | ${0}
    ${'2-0-1'}           | ${1}
    ${'2.31-13+rpm11u5'} | ${13}
    ${'1:2.3.1'}         | ${1}
    ${'foo'}             | ${null}
    ${'8'}               | ${null}
    ${'1.0'}             | ${null}
  `('getPatch("$version") === $expected', ({ version, expected }) => {
    expect(rpm.getPatch(version)).toBe(expected);
  });
});
