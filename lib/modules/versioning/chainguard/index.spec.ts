import chainguard from '.';

describe('modules/versioning/chainguard/index', () => {
  it.each`
    a                        | b                        | expected
    ${'latest'}              | ${'latest'}              | ${false}
    ${'1.2.3-202403281959'}  | ${'1.2.3'}               | ${true}
    ${'1.2.3-202403281959'}  | ${'1.2-202403181217'}    | ${true}
    ${'latest-202403281959'} | ${'latest-202403181217'} | ${true}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(chainguard.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    a               | b               | expected
    ${'latest'}     | ${'latest'}     | ${true}
    ${'latest-dev'} | ${'latest-dev'} | ${true}
    ${'latest-dev'} | ${'latest'}     | ${false}
  `('isCompatible("$a", "$b") === $expected', ({ a, b, expected }) => {
    const res = chainguard.isCompatible(a, b);
    expect(!!res).toBe(expected);
  });
});
