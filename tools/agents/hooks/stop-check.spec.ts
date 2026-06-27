// https://code.claude.com/docs/en/hooks#stop
import { BlockOutput } from './utils/schemas.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));

const { getChangedFiles } = vi.hoisted(() => ({
  getChangedFiles: vi.fn<() => Promise<string[]>>(),
}));
vi.mock('./utils/git.ts', () => ({ getChangedFiles }));

const consoleSpy = vi.spyOn(console, 'log');

beforeEach(() => {
  vi.resetModules();
  exec.mockReset();
  getChangedFiles.mockReset();
  consoleSpy.mockReset();
});

it('runs pnpm check --all with changed files', async () => {
  getChangedFiles.mockResolvedValue(['lib/foo.ts', 'lib/bar.ts']);
  exec.mockResolvedValue(undefined);

  await import('./stop-check.ts');

  expect(exec).toHaveBeenCalledWith('pnpm', [
    'check',
    '--all',
    'lib/foo.ts',
    'lib/bar.ts',
  ]);
  expect(consoleSpy).not.toHaveBeenCalled();
});

it('runs pnpm check --all without targets when no files changed', async () => {
  getChangedFiles.mockResolvedValue([]);
  exec.mockResolvedValue(undefined);

  await import('./stop-check.ts');

  expect(exec).toHaveBeenCalledWith('pnpm', ['check', '--all']);
  expect(consoleSpy).not.toHaveBeenCalled();
});

it('outputs block JSON when pnpm check --all fails', async () => {
  getChangedFiles.mockResolvedValue(['lib/foo.ts']);
  exec.mockRejectedValue(new Error('check failed'));

  await import('./stop-check.ts');

  expect(consoleSpy).toHaveBeenCalledOnce();
  const output = BlockOutput.parse(JSON.parse(consoleSpy.mock.calls[0][0]));
  expect(output).toEqual({
    decision: 'block',
    reason:
      'pnpm check --all failed — the issues must be resolved before finishing',
  });
});
