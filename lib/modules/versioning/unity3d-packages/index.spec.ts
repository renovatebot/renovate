import unity3dPackages from '.';

describe('modules/versioning/unity3d-packages/index', () => {
  it.each`
    input                | expected
    ${'1'}               | ${false}
    ${'1.2'}             | ${false}
    ${'1.2.3'}           | ${true}
    ${'1.2.3-4'}         | ${true}
    ${'1.2.3-exp.1'}     | ${true}
    ${'1.2.3-pre.1'}     | ${true}
    ${'1.2.3-preview.1'} | ${true}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!unity3dPackages.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    input                | expected
    ${'1.2.3'}           | ${true}
    ${'1.2.3-4'}         | ${true}
    ${'1.2.3-exp.1'}     | ${false}
    ${'1.2.3-pre.1'}     | ${false}
    ${'1.2.3-preview.1'} | ${false}
  `('isStable("$input") === $expected', ({ input, expected }) => {
    expect(unity3dPackages.isStable(input)).toBe(expected);
  });

  it.each`
    a                    | b                    | expected
    ${'1.2.3'}           | ${'1.2.3'}           | ${true}
    ${'1.2.3-4'}         | ${'1.2.3-4'}         | ${true}
    ${'1.2.3-exp.1'}     | ${'1.2.3-exp.1'}     | ${true}
    ${'1.2.3-pre.1'}     | ${'1.2.3-pre.1'}     | ${true}
    ${'1.2.3-preview.1'} | ${'1.2.3-preview.1'} | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(unity3dPackages.equals(a, b)).toBe(expected);
  });

  it.each`
    a                 | b                | expected
    ${'1.2.4'}        | ${'1.2.3'}       | ${true}
    ${'1.2.3-exp.1'}  | ${'1.2.3'}       | ${false}
    ${'1.2.3'}        | ${'1.2.3-1'}     | ${false}
    ${'1.2.3-exp.10'} | ${'1.2.3-exp.2'} | ${true}
    ${'1.2.3-exp.2'}  | ${'1.2.3-exp.1'} | ${true}
    ${'1.2.3-pre.1'}  | ${'1.2.3-exp.2'} | ${true}
    ${'1.2.3-pre.10'} | ${'1.2.3-pre.2'} | ${true}
    ${'1.2.3-pre.2'}  | ${'1.2.3-pre.1'} | ${true}
    ${'1.2.3'}        | ${'1.2.3-pre.2'} | ${true}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(unity3dPackages.isGreaterThan(a, b)).toBe(expected);
  });
});
