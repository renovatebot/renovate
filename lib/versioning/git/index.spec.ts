import git from '.';

describe('versioning/git/index', () => {
  test.each`
    input       | expected
    ${''}       | ${true}
    ${'1'}      | ${true}
    ${'a'}      | ${true}
    ${'a1'}     | ${true}
    ${'foobar'} | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    expect(git.isValid(input)).toBe(expected);
  });

  test.each`
    version               | range | expected
    ${''}                 | ${''} | ${true}
    ${'1234567890aBcDeF'} | ${''} | ${true}
  `(
    'isCompatible("$version") === $expected',
    ({ version, range, expected }) => {
      const res = git.isCompatible(version, range);
      expect(!!res).toBe(expected);
    }
  );

  test.each`
    a        | b        | expected
    ${''}    | ${''}    | ${false}
    ${'abc'} | ${'bca'} | ${false}
    ${'123'} | ${'321'} | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(git.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    value    | expected
    ${''}    | ${''}
    ${'123'} | ${'123'}
    ${'321'} | ${'321'}
  `('valueToVersion("$value") === $expected', ({ value, expected }) => {
    const res = git.valueToVersion(value);
    expect(res).toBe(expected);
  });
});
