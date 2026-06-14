import { LongCommitSha, isLongCommitSha, toLongCommitSha } from './git.ts';

describe('util/schema-utils/git', () => {
  const sha40 = '0123456789abcdef0123456789abcdef01234567';

  it('parses a valid 40-char sha', () => {
    expect(LongCommitSha.parse(sha40)).toBe(sha40);
  });

  it('rejects a short sha', () => {
    expect(() => LongCommitSha.parse('abc')).toThrow();
  });

  it('isLongCommitSha returns true for valid sha', () => {
    expect(isLongCommitSha(sha40)).toBe(true);
  });

  it('isLongCommitSha returns false for short sha', () => {
    expect(isLongCommitSha('abc')).toBe(false);
  });

  it('isLongCommitSha returns false for non-string', () => {
    expect(isLongCommitSha(42)).toBe(false);
  });

  it('toLongCommitSha returns branded value for valid sha', () => {
    expect(toLongCommitSha(sha40)).toBe(sha40);
  });

  it('toLongCommitSha throws for invalid value', () => {
    expect(() => toLongCommitSha('short')).toThrow(
      'Invalid long commit SHA: short',
    );
  });
});
