import {
  LongCommitSha,
  ShortCommitSha,
  isLongCommitSha,
  isShortCommitSha,
  toLongCommitSha,
} from './git.ts';

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
      expect(() => LongCommitSha.parse(value)).toThrow(
        'Invalid string: must match pattern /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u',
      );
    });
  });

  describe('isLongCommitSha', () => {
    it.each([
      ['40-char sha', sha40, true],
      ['64-char sha', sha64, true],
      ['short sha', 'abc', false],
      ['uppercase 40-char sha', sha40.toUpperCase(), false],
      ['non-hex 40-char string', 'g'.repeat(40), false],
      ['non-string', 42, false],
    ])('%s → %s', (_label, value, expected) => {
      expect(isLongCommitSha(value)).toBe(expected);
    });
  });

  describe('ShortCommitSha', () => {
    it.each([
      ['6-char sha', '012abc'],
      ['7-char sha', '012abcd'],
    ])('parses a valid %s', (_label, sha) => {
      expect(ShortCommitSha.parse(sha)).toBe(sha);
    });

    it.each([
      ['5-char sha', '012ab'],
      ['8-char sha', '012abcde'],
      ['uppercase short sha', '012ABC'],
      ['non-hex 6-char string', 'g'.repeat(6)],
    ])('rejects a %s', (_label, value) => {
      expect(() => ShortCommitSha.parse(value)).toThrow(
        'Invalid string: must match pattern /^(?:[a-f0-9]{6,7})$/u',
      );
    });
  });

  describe('isShortCommitSha', () => {
    it.each([
      ['6-char sha', '012abc', true],
      ['7-char sha', '012abcd', true],
      ['5-char sha', '012ab', false],
      ['8-char sha', '012abcde', false],
      ['uppercase short sha', '012ABC', false],
      ['non-hex 6-char string', 'g'.repeat(6), false],
      ['non-string', 42, false],
    ])('%s → %s', (_label, value, expected) => {
      expect(isShortCommitSha(value)).toBe(expected);
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
