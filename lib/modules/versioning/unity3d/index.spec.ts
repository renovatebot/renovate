import unity3d from '.';

describe('modules/versioning/unity3d/index', () => {
  it.each`
    input                           | expected
    ${'9.0.3'}                      | ${false}
    ${'1.2019.3.22'}                | ${false}
    ${'3.0.0-beta'}                 | ${false}
    ${'2.0.2-pre20191018090318'}    | ${false}
    ${'1.0.0+c30d7625'}             | ${false}
    ${'2.3.4-beta+1990ef74'}        | ${false}
    ${'17.04'}                      | ${false}
    ${'3.0.0.beta'}                 | ${false}
    ${'5.1.2-+'}                    | ${false}
    ${'2022.2.12f1 (1234567890ab)'} | ${true}
    ${'2022.2.11 (1234567890ab)'}   | ${false}
    ${'2021.1.10p1 (1234567890ab)'} | ${true}
    ${'2021.1.9b1 (1234567890ab)'}  | ${true}
    ${'2021.1.1a1 (1234567890ab)'}  | ${true}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!unity3d.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    input                           | expected
    ${'2022.2.12f1 (1234567890ab)'} | ${true}
    ${'2021.1.10p1 (1234567890ab)'} | ${false}
    ${'2021.1.9b1 (1234567890ab)'}  | ${false}
    ${'2021.1.1a1 (1234567890ab)'}  | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(unity3d.isStable(input)).toBe(expected);
  });

  it.each`
    a                               | b                               | expected
    ${'2022.2.12f1 (1234567890ab)'} | ${'2022.2.12f1 (1234567890ab)'} | ${true}
    ${'2021.1.10p1 (1234567890ab)'} | ${'2021.1.10p1 (1234567890ab)'} | ${true}
    ${'2021.1.9b1 (1234567890ab)'}  | ${'2021.1.9b1 (1234567890ab)'}  | ${true}
    ${'2021.1.1a1 (1234567890ab)'}  | ${'2021.1.1a1 (1234567890ab)'}  | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(unity3d.equals(a, b)).toBe(expected);
  });

  it.each`
    a                               | b                               | expected
    ${'2022.2.12f1 (1234567890ab)'} | ${'2022.2.12b1 (1234567890ab)'} | ${true}
    ${'2022.2.12f1 (1234567890ab)'} | ${'2021.1.10p1 (1234567890ab)'} | ${true}
    ${'2021.1.10p1 (1234567890ab)'} | ${'2021.1.9b1 (1234567890ab)'}  | ${true}
    ${'2021.1.9b1 (1234567890ab)'}  | ${'2021.1.1a1 (1234567890ab)'}  | ${true}
    ${'2021.1.10p1 (1234567890ab)'} | ${'2022.2.12f1 (1234567890ab)'} | ${false}
    ${'2021.1.9b1 (1234567890ab)'}  | ${'2021.1.10p1 (1234567890ab)'} | ${false}
    ${'2021.1.1a1 (1234567890ab)'}  | ${'2021.1.9b1 (1234567890ab)'}  | ${false}
    ${'2022.2.12b1 (1234567890ab)'} | ${'2022.2.12f1 (1234567890ab)'} | ${false}
    ${'2021.1.10p1 (1234567890ab)'} | ${'2022.2.12f1 (1234567890ab)'} | ${false}
    ${'2021.1.9b1 (1234567890ab)'}  | ${'2021.1.10p1 (1234567890ab)'} | ${false}
    ${'2021.1.1a1 (1234567890ab)'}  | ${'2021.1.9b1 (1234567890ab)'}  | ${false}
    ${'2022.2.12f1 (1234567890ab)'} | ${'2021.1.10p1 (1234567890ab)'} | ${true}
    ${'2021.1.10p1 (1234567890ab)'} | ${'2021.1.9b1 (1234567890ab)'}  | ${true}
    ${'2021.1.9b1 (1234567890ab)'}  | ${'2021.1.1a1 (1234567890ab)'}  | ${true}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(unity3d.isGreaterThan(a, b)).toBe(expected);
  });
});
