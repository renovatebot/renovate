import nuget from '.';

describe('modules/versioning/nuget/index', () => {
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
    const res = !!nuget.isValid(input);
    expect(res).toBe(expected);
  });

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
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    const res = !!nuget.isVersion(input);
    expect(res).toBe(expected);
  });

  it.each`
    input                        | expected
    ${'9.0.3'}                   | ${true}
    ${'1.2019.3.22'}             | ${true}
    ${'3.0.0-beta'}              | ${false}
    ${'2.0.2-pre20191018090318'} | ${false}
    ${'1.0.0+c30d7625'}          | ${true}
    ${'2.3.4-beta+1990ef74'}     | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(nuget.isStable(input)).toBe(expected);
  });

  it.each`
    a            | b                   | expected
    ${'17.4'}    | ${'17.04'}          | ${true}
    ${'1.4'}     | ${'1.4.0'}          | ${true}
    ${'1.0.110'} | ${'1.0.110.0'}      | ${true}
    ${'1.0.0'}   | ${'1.0.0+c30d7625'} | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(nuget.equals(a, b)).toBe(expected);
  });

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
    ${undefined}        | ${'1.2.0'}         | ${true}
    ${'1.2.0+1'}        | ${'1.2.0'}         | ${false}
    ${'1.2.0'}          | ${'1.2.0+1'}       | ${false}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(nuget.isGreaterThan(a, b)).toBe(expected);
  });
});
