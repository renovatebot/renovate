import { LongCommitSha, isLongCommitSha, toLongCommitSha } from './git.ts';

describe('util/schema-utils/git', () => {
  const sha40 = '0123456789abcdef0123456789abcdef01234567';
  const sha64 =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('LongCommitSha', () => {
    it.each([
      ['40-char sha', sha40],
      ['64-char sha', sha64],
    ])('parses a valid %s', (_label, sha) => {
      expect(LongCommitSha.parse(sha)).toBe(sha);
    });

    it.each([
      ['short sha', 'abc'],
      ['non-hex 40-char string', 'g'.repeat(40)],
    ])('rejects a %s', (_label, value) => {
      expect(() => LongCommitSha.parse(value)).toThrow();
    });
  });

  describe('isLongCommitSha', () => {
    it.each([
      ['40-char sha', sha40, true],
      ['64-char sha', sha64, true],
      ['short sha', 'abc', false],
      ['non-hex 40-char string', 'g'.repeat(40), false],
      ['non-string', 42, false],
    ])('%s → %s', (_label, value, expected) => {
      expect(isLongCommitSha(value)).toBe(expected);
    });
  });

  describe('toLongCommitSha', () => {
    it.each([
      ['40-char sha', sha40],
      ['64-char sha', sha64],
    ])('returns branded value for %s', (_label, sha) => {
      expect(toLongCommitSha(sha)).toBe(sha);
    });

    it('throws for invalid value', () => {
      expect(() => toLongCommitSha('short')).toThrow(
        'Invalid long commit SHA: short',
      );
    });
  });
});
