import { getChangedFiles, getRepoRoot } from './git.ts';

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

beforeEach(() => {
  mockGit.env.mockReturnValue(mockGit);
});

it('returns changed files using merge-base with origin/main', async () => {
  mockGit.raw.mockResolvedValueOnce('abc1234\n');
  mockGit.diff.mockResolvedValueOnce('lib/foo.ts\nlib/bar.ts\n');

  const result = await getChangedFiles();

  expect(mockGit.raw).toHaveBeenCalledWith([
    'merge-base',
    'origin/main',
    'HEAD',
  ]);
  expect(mockGit.diff).toHaveBeenCalledWith([
    '--name-only',
    '--diff-filter=ACMR',
    'abc1234',
  ]);
  expect(result).toEqual(['lib/foo.ts', 'lib/bar.ts']);
});

it('falls back to upstream tracking branch when origin/main is not available', async () => {
  mockGit.raw.mockRejectedValueOnce(new Error('no origin/main'));
  mockGit.revparse.mockResolvedValueOnce('upstream/feature\n');
  mockGit.diff.mockResolvedValueOnce('lib/foo.ts\n');

  const result = await getChangedFiles();

  expect(mockGit.revparse).toHaveBeenCalledWith([
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  expect(mockGit.diff).toHaveBeenCalledWith([
    '--name-only',
    '--diff-filter=ACMR',
    'upstream/feature',
  ]);
  expect(result).toEqual(['lib/foo.ts']);
});

it('falls back to HEAD when neither origin/main nor upstream is available', async () => {
  mockGit.raw.mockRejectedValueOnce(new Error('no origin/main'));
  mockGit.revparse.mockRejectedValueOnce(new Error('no upstream'));
  mockGit.diff.mockResolvedValueOnce('lib/foo.ts\n');

  const result = await getChangedFiles();

  expect(mockGit.diff).toHaveBeenCalledWith([
    '--name-only',
    '--diff-filter=ACMR',
    'HEAD',
  ]);
  expect(result).toEqual(['lib/foo.ts']);
});

it('returns empty array when no files changed', async () => {
  mockGit.raw.mockResolvedValueOnce('abc1234\n');
  mockGit.diff.mockResolvedValueOnce('');

  const result = await getChangedFiles();

  expect(result).toEqual([]);
});

it('getRepoRoot returns trimmed path when git reports a toplevel', async () => {
  mockGit.revparse.mockResolvedValueOnce('/home/user/repo\n');

  const result = await getRepoRoot('/home/user/repo/sub');

  expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
  expect(result).toBe('/home/user/repo');
});

it('getRepoRoot returns null when not inside a git repo', async () => {
  mockGit.revparse.mockRejectedValueOnce(new Error('not a git repo'));

  const result = await getRepoRoot('/tmp/not-a-repo');

  expect(result).toBeNull();
});

it('getRepoRoot returns null when output is empty', async () => {
  mockGit.revparse.mockResolvedValueOnce('');

  const result = await getRepoRoot();

  expect(result).toBeNull();
});
