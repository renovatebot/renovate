import git from '.';

describe('modules/versioning/git/index', () => {
  it.each`
    input                                         | expected
    ${''}                                         | ${false}
    ${'2'}                                        | ${false}
    ${'29'}                                       | ${false}
    ${'29c'}                                      | ${false}
    ${'29c7'}                                     | ${false}
    ${'29c79'}                                    | ${false}
    ${'29c792'}                                   | ${false}
    ${'29c7921'}                                  | ${true}
    ${'29c792109259545157f4bc3f8d43f47ffcf34e20'} | ${true}
    ${'foobar'}                                   | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    expect(git.isValid(input)).toBe(expected);
  });

  it.each`
    version               | range | expected
    ${''}                 | ${''} | ${false}
    ${'1234567890aBcDeF'} | ${''} | ${true}
  `(
    'isCompatible("$version") === $expected',
    ({ version, range, expected }) => {
      const res = git.isCompatible(version, range);
      expect(!!res).toBe(expected);
    },
  );

  it.each`
    a        | b        | expected
    ${''}    | ${''}    | ${false}
    ${'abc'} | ${'bca'} | ${false}
    ${'123'} | ${'321'} | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(git.isGreaterThan(a, b)).toBe(expected);
  });
});
