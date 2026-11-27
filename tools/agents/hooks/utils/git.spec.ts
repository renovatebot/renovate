import { getRepoRoot } from './git.ts';

const mockGit = vi.hoisted(() => ({ revparse: vi.fn() }));

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

describe('tools/agents/hooks/utils/git', () => {
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

      const result = await getRepoRoot('/home/user/repo');

      expect(result).toBeNull();
    });
  });
});
