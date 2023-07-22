import loose from '.';

describe('modules/versioning/loose/index', () => {
  it.each`
    version      | expected
    ${'1.1'}     | ${true}
    ${'1.3.RC2'} | ${true}
    ${'2.1-rc2'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!loose.isVersion(version)).toBe(expected);
  });

  it.each`
    version                                        | expected
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
    ${'foo'}                                       | ${false}
    ${'1.2.3.4.5.6.7'}                             | ${false}
    ${'0a1b2c3'}                                   | ${false}
    ${'0a1b2c3d'}                                  | ${false}
    ${'0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d'}  | ${false}
    ${'0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0'} | ${true}
    ${'0a1b2C3'}                                   | ${true}
    ${'0z1b2c3'}                                   | ${true}
    ${'0A1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d'}  | ${true}
    ${'123098140293'}                              | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!loose.isValid(version)).toBe(expected);
  });

  it.each`
    a          | b          | expected
    ${'2.4'}   | ${'2.4'}   | ${true}
    ${'2.4.0'} | ${'2.4.0'} | ${true}
    ${'2.4.0'} | ${'2.4'}   | ${false}
    ${'2.4.1'} | ${'2.4'}   | ${false}
    ${'2.4.2'} | ${'2.4.1'} | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(loose.equals(a, b)).toBe(expected);
  });

  it.each`
    a                               | b                               | expected
    ${'2.4.0'}                      | ${'2.4'}                        | ${true}
    ${'2.4.2'}                      | ${'2.4.1'}                      | ${true}
    ${'2.4.beta'}                   | ${'2.4.alpha'}                  | ${true}
    ${'1.9'}                        | ${'2'}                          | ${false}
    ${'1.9'}                        | ${'1.9.1'}                      | ${false}
    ${'2.4'}                        | ${'2.4.beta'}                   | ${true}
    ${'2.4.0'}                      | ${'2.4.beta'}                   | ${true}
    ${'2.4.beta'}                   | ${'2.4'}                        | ${false}
    ${'2.4.beta'}                   | ${'2.4.0'}                      | ${false}
    ${'2024-07-21T11-33-05.abc123'} | ${'2023-06-21T11-33-05.abc123'} | ${true}
    ${'2023-07-21T11-33-05.abc123'} | ${'2023-07-21T11-33-04.abc123'} | ${true}
    ${'2023-07-21-113305-abc123'}   | ${'2023-07-21-113304-abc123'}   | ${true}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(loose.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    version    | expected
    ${'1.2.0'} | ${true}
  `('isCompatible("$version") === $expected', ({ version, expected }) => {
    expect(loose.isCompatible(version)).toBe(expected);
  });

  it.each`
    version     | expected
    ${'1.2.0'}  | ${true}
    ${'^1.2.0'} | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(loose.isSingleVersion(version)).toBe(expected);
  });
});
