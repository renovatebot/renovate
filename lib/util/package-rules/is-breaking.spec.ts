import { IsBreakingMatcher } from './is-breaking.ts';

describe('util/package-rules/is-breaking', () => {
  const matcher = new IsBreakingMatcher();

  it('returns null if matchIsBreaking is not configured', () => {
    const result = matcher.matches({ isBreaking: true }, {});

    expect(result).toBeNull();
  });

  it.each`
    matchIsBreaking
    ${true}
    ${false}
  `(
    'returns false if isBreaking is undefined and matchIsBreaking=$matchIsBreaking',
    ({ matchIsBreaking }: { matchIsBreaking: boolean }) => {
      const result = matcher.matches({}, { matchIsBreaking });

      expect(result).toBeFalse();
    },
  );

  it.each`
    isBreaking | matchIsBreaking | expected
    ${true}    | ${true}         | ${true}
    ${false}   | ${true}         | ${false}
    ${true}    | ${false}        | ${false}
    ${false}   | ${false}        | ${true}
  `(
    'returns $expected if isBreaking=$isBreaking and matchIsBreaking=$matchIsBreaking',
    ({
      isBreaking,
      matchIsBreaking,
      expected,
    }: {
      isBreaking: boolean;
      matchIsBreaking: boolean;
      expected: boolean;
    }) => {
      const result = matcher.matches({ isBreaking }, { matchIsBreaking });

      expect(result).toBe(expected);
    },
  );
});
