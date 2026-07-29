import { findMajorCommits, getReleaseType } from './check-major-release.ts';

describe('tools/check-major-release', () => {
  describe('getReleaseType', () => {
    it('returns null when there is no release', async () => {
      expect(await getReleaseType(['chore(deps): bump x', 'ci: tweak'])).toBe(
        null,
      );
    });

    it('returns patch for a fix', async () => {
      expect(await getReleaseType(['fix: correct a bug'])).toBe('patch');
    });

    it('returns minor for a feature', async () => {
      expect(await getReleaseType(['feat: add a thing'])).toBe('minor');
    });

    it.each`
      message
      ${'feat!: drop node 20 support'}
      ${'feat(config)!: rename option'}
      ${'fix: something\n\nBREAKING CHANGE: removes the old API'}
      ${'refactor: cleanup\n\nBREAKING-CHANGE: hyphenated form'}
    `('returns major for breaking commit: $message', async ({ message }) => {
      expect(await getReleaseType([message as string])).toBe('major');
    });

    it('uses the highest release type across commits', async () => {
      expect(
        await getReleaseType(['fix: a', 'feat!: breaking', 'chore: nothing']),
      ).toBe('major');
    });
  });

  describe('findMajorCommits', () => {
    it('lists only the commits that trigger a major', async () => {
      const messages = [
        'feat: normal',
        'feat(config)!: rename option',
        'fix: another',
      ];
      expect(await findMajorCommits(messages)).toEqual([
        'feat(config)!: rename option',
      ]);
    });

    it('returns an empty array when nothing is breaking', async () => {
      expect(await findMajorCommits(['feat: a', 'fix: b'])).toEqual([]);
    });
  });
});
