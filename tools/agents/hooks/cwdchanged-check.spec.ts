// https://code.claude.com/docs/en/hooks#cwdchanged

const { readStdin } = vi.hoisted(() => ({
  readStdin: vi.fn<() => Promise<string>>(),
}));
vi.mock('./utils/stdin.ts', () => ({ readStdin }));

const { getRepoRoot } = vi.hoisted(() => ({
  getRepoRoot: vi.fn<(dir?: string) => Promise<string | null>>(),
}));
vi.mock('./utils/git.ts', () => ({ getRepoRoot, getChangedFiles: vi.fn() }));

const { provision } = vi.hoisted(() => ({ provision: vi.fn() }));
vi.mock('./utils/provision.ts', () => ({ provision }));

const { existsSync } = vi.hoisted(() => ({
  existsSync: vi.fn<(path: string) => boolean>(),
}));
vi.mock('node:fs', () => ({ existsSync }));

const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit');
});

beforeEach(() => {
  vi.resetModules();
  readStdin.mockReset();
  getRepoRoot.mockReset();
  provision.mockReset();
  existsSync.mockReset();
  exitSpy.mockClear();
});

it('exits with code 1 when stdin is not valid JSON', async () => {
  readStdin.mockResolvedValue('not json');

  await expect(import('./cwdchanged-check.ts')).rejects.toThrow('process.exit');

  expect(exitSpy).toHaveBeenCalledWith(1);
  expect(provision).not.toHaveBeenCalled();
});

it('exits with code 1 when hook_event_name is wrong', async () => {
  readStdin.mockResolvedValue(
    JSON.stringify({
      session_id: 'x',
      transcript_path: 'x',
      cwd: '/some/dir',
      hook_event_name: 'SessionStart',
    }),
  );

  await expect(import('./cwdchanged-check.ts')).rejects.toThrow('process.exit');

  expect(exitSpy).toHaveBeenCalledWith(1);
  expect(provision).not.toHaveBeenCalled();
});

it('exits silently when directory is not a git repo (getRepoRoot returns null)', async () => {
  readStdin.mockResolvedValue(
    JSON.stringify({
      session_id: 'x',
      transcript_path: 'x',
      cwd: '/not/a/repo',
      hook_event_name: 'CwdChanged',
    }),
  );
  getRepoRoot.mockResolvedValue(null);

  await expect(import('./cwdchanged-check.ts')).rejects.toThrow('process.exit');

  expect(exitSpy).toHaveBeenCalledWith(0);
  expect(provision).not.toHaveBeenCalled();
});

it('exits silently when node_modules already exists (already installed checkout)', async () => {
  readStdin.mockResolvedValue(
    JSON.stringify({
      session_id: 'x',
      transcript_path: 'x',
      cwd: '/repo/sub',
      hook_event_name: 'CwdChanged',
    }),
  );
  getRepoRoot.mockResolvedValue('/repo');
  existsSync.mockReturnValue(true);

  await expect(import('./cwdchanged-check.ts')).rejects.toThrow('process.exit');

  expect(exitSpy).toHaveBeenCalledWith(0);
  expect(existsSync).toHaveBeenCalledWith('/repo/node_modules');
  expect(provision).not.toHaveBeenCalled();
});

it('provisions the root when it is a fresh worktree (no node_modules)', async () => {
  readStdin.mockResolvedValue(
    JSON.stringify({
      session_id: 'x',
      transcript_path: 'x',
      cwd: '/worktrees/my-feature',
      hook_event_name: 'CwdChanged',
    }),
  );
  getRepoRoot.mockResolvedValue('/worktrees/my-feature');
  existsSync.mockReturnValue(false);
  provision.mockResolvedValue(undefined);

  await import('./cwdchanged-check.ts');

  expect(getRepoRoot).toHaveBeenCalledWith('/worktrees/my-feature');
  expect(existsSync).toHaveBeenCalledWith('/worktrees/my-feature/node_modules');
  expect(provision).toHaveBeenCalledWith('/worktrees/my-feature');
  expect(exitSpy).not.toHaveBeenCalled();
});
