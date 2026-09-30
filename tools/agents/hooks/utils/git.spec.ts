import { getBaseRef, getChangedFiles, getRepoRoot } from './git.ts';

const mockGit = vi.hoisted(() => {
  const obj = {
    raw: vi.fn(),
    revparse: vi.fn(),
    diff: vi.fn(),
    env: vi.fn(),
  };
  obj.env.mockReturnValue(obj);
  return obj;
});

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

describe('tools/agents/hooks/utils/git', () => {
  beforeEach(() => {
    mockGit.env.mockReturnValue(mockGit);
  });

  describe('getBaseRef', () => {
    it('returns the merge-base with origin/main', async () => {
      mockGit.raw.mockResolvedValueOnce('abc1234\n');

      const result = await getBaseRef();

      expect(mockGit.raw).toHaveBeenCalledWith([
        'merge-base',
        'origin/main',
        'HEAD',
      ]);
      expect(result).toBe('abc1234');
    });

    it('falls back to upstream tracking branch when origin/main is not available', async () => {
      mockGit.raw.mockRejectedValueOnce(new Error('no origin/main'));
      mockGit.revparse.mockResolvedValueOnce('upstream/feature\n');

      const result = await getBaseRef();

      expect(mockGit.revparse).toHaveBeenCalledWith([
        '--abbrev-ref',
        '--symbolic-full-name',
        '@{u}',
      ]);
      expect(result).toBe('upstream/feature');
    });

    it('falls back to HEAD when neither origin/main nor upstream is available', async () => {
      mockGit.raw.mockRejectedValueOnce(new Error('no origin/main'));
      mockGit.revparse.mockRejectedValueOnce(new Error('no upstream'));

      const result = await getBaseRef();

      expect(result).toBe('HEAD');
    });
  });

  describe('getChangedFiles', () => {
    it('returns the files changed since the base ref', async () => {
      mockGit.diff.mockResolvedValueOnce('lib/foo.ts\nlib/bar.ts\n');

      const result = await getChangedFiles('abc1234');

      expect(mockGit.diff).toHaveBeenCalledWith([
        '--name-only',
        '--diff-filter=ACMR',
        'abc1234',
      ]);
      expect(result).toEqual(['lib/foo.ts', 'lib/bar.ts']);
    });

    it('returns empty array when no files changed', async () => {
      mockGit.diff.mockResolvedValueOnce('');

      const result = await getChangedFiles('abc1234');

      expect(result).toEqual([]);
    });
  });

  describe('getRepoRoot', () => {
    it('returns trimmed path when git reports a toplevel', async () => {
      mockGit.revparse.mockResolvedValueOnce('/home/user/repo\n');

      const result = await getRepoRoot('/home/user/repo/sub');

      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
      expect(result).toBe('/home/user/repo');
    });

    it('returns null when not inside a git repo', async () => {
      mockGit.revparse.mockRejectedValueOnce(new Error('not a git repo'));

      const result = await getRepoRoot('/tmp/not-a-repo');

      expect(result).toBeNull();
    });

    it('returns null when output is empty', async () => {
      mockGit.revparse.mockResolvedValueOnce('');

      const result = await getRepoRoot();

      expect(result).toBeNull();
    });
  });
});
