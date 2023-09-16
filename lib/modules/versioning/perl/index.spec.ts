import perl from '.';

describe('modules/versioning/perl/index', () => {
  it.each`
    input           | expected
    ${'1'}          | ${true}
    ${'1.2'}        | ${true}
    ${'1.02'}       | ${true}
    ${'1.002'}      | ${true}
    ${'1.0023'}     | ${true}
    ${'1.00203'}    | ${true}
    ${'1.002003'}   | ${true}
    ${'1.002_003'}  | ${true}
    ${'1._002003'}  | ${false}
    ${'1.002003_'}  | ${false}
    ${'1.00_20_03'} | ${false}
    ${'v1'}         | ${true}
    ${'v1.200'}     | ${true}
    ${'v1.20.0'}    | ${true}
    ${'v1.2.3'}     | ${true}
    ${'1.2.3'}      | ${true}
    ${'v1.2_3'}     | ${true}
    ${'v1._23'}     | ${false}
    ${'v1.23_'}     | ${false}
    ${'v1.2_3_4'}   | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!perl.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    input         | expected
    ${'1'}        | ${true}
    ${'1.234'}    | ${true}
    ${'1.2_34'}   | ${false}
    ${'v1'}       | ${true}
    ${'v1.2'}     | ${true}
    ${'v1.2.3'}   | ${true}
    ${'v1.2.3_4'} | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(perl.isStable(input)).toBe(expected);
  });

  it.each`
    a             | b              | expected
    ${'1.2'}      | ${'v1.200.0'}  | ${true}
    ${'1.02'}     | ${'v1.20.0'}   | ${true}
    ${'1.002'}    | ${'v1.2.0'}    | ${true}
    ${'1.0023'}   | ${'v1.2.300'}  | ${true}
    ${'1.00203'}  | ${'v1.2.30'}   | ${true}
    ${'1.002003'} | ${'v1.2.3'}    | ${true}
    ${'1.02_03'}  | ${'1.020_3'}   | ${true}
    ${'1.02_03'}  | ${'v1.20_300'} | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(perl.equals(a, b)).toBe(expected);
  });

  it.each`
    a            | b            | expected
    ${'2.4.2'}   | ${'2.4.1'}   | ${true}
    ${'0.1301'}  | ${'0.13_01'} | ${true}
    ${'0.13_01'} | ${'0.1301'}  | ${false}
    ${'1.900'}   | ${'2.000'}   | ${false}
    ${'1.900'}   | ${'1.901'}   | ${false}
    ${'1.2.0.1'} | ${'1.2.0'}   | ${true}
    ${'1.2.0'}   | ${'1.2.0.1'} | ${false}
    ${undefined} | ${'1.2.0'}   | ${true}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(perl.isGreaterThan(a, b)).toBe(expected);
  });
});
