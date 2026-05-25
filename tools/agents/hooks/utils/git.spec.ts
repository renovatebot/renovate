import { getChangedFiles } from './git.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./exec.ts', () => ({ exec }));

beforeEach(() => {
  exec.mockReset();
});

it('returns changed files using merge-base with origin/main', async () => {
  exec
    .mockResolvedValueOnce({ stdout: 'abc1234\n' })
    .mockResolvedValueOnce({ stdout: 'lib/foo.ts\nlib/bar.ts\n' });

  const result = await getChangedFiles();

  expect(exec).toHaveBeenNthCalledWith(
    1,
    'git',
    ['merge-base', 'origin/main', 'HEAD'],
    { stdout: 'pipe' },
  );
  expect(exec).toHaveBeenNthCalledWith(
    2,
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', 'abc1234'],
    { stdout: 'pipe' },
  );
  expect(result).toEqual(['lib/foo.ts', 'lib/bar.ts']);
});

it('falls back to upstream tracking branch when origin/main is not available', async () => {
  exec
    .mockRejectedValueOnce(new Error('no origin/main'))
    .mockResolvedValueOnce({ stdout: 'upstream/feature\n' })
    .mockResolvedValueOnce({ stdout: 'lib/foo.ts\n' });

  const result = await getChangedFiles();

  expect(exec).toHaveBeenNthCalledWith(
    2,
    'git',
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    { stdout: 'pipe' },
  );
  expect(exec).toHaveBeenNthCalledWith(
    3,
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', 'upstream/feature'],
    { stdout: 'pipe' },
  );
  expect(result).toEqual(['lib/foo.ts']);
});

it('falls back to HEAD when neither origin/main nor upstream is available', async () => {
  exec
    .mockRejectedValueOnce(new Error('no origin/main'))
    .mockRejectedValueOnce(new Error('no upstream'))
    .mockResolvedValueOnce({ stdout: 'lib/foo.ts\n' });

  const result = await getChangedFiles();

  expect(exec).toHaveBeenNthCalledWith(
    3,
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'],
    { stdout: 'pipe' },
  );
  expect(result).toEqual(['lib/foo.ts']);
});

it('returns empty array when no files changed', async () => {
  exec
    .mockResolvedValueOnce({ stdout: 'abc1234\n' })
    .mockResolvedValueOnce({ stdout: '' });

  const result = await getChangedFiles();

  expect(result).toEqual([]);
});
