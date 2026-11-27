import { provision } from './provision.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('../../../utils/exec.ts', () => ({ exec }));
const errorSpy = vi.spyOn(console, 'error');
const stderrOptions = { stdout: process.stderr, stderr: process.stderr };

it('runs mise install then pnpm install', async () => {
  exec.mockResolvedValue(undefined);

  await provision();

  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenNthCalledWith(1, 'mise', ['install'], stderrOptions);
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install'], stderrOptions);
});

it('passes cwd to both commands when provided', async () => {
  exec.mockResolvedValue(undefined);

  await provision('/some/worktree');

  expect(exec).toHaveBeenNthCalledWith(1, 'mise', ['install'], {
    ...stderrOptions,
    cwd: '/some/worktree',
  });
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install'], {
    ...stderrOptions,
    cwd: '/some/worktree',
  });
});

it('skips mise failure gracefully and still runs pnpm install', async () => {
  exec
    .mockRejectedValueOnce(new Error('mise not found'))
    .mockResolvedValueOnce(undefined);

  await provision();

  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install'], stderrOptions);
  expect(errorSpy).toHaveBeenCalledWith(
    'mise is not installed or failed — skipping',
  );
});

it('propagates error if pnpm install fails', async () => {
  exec
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('install failed'));

  await expect(provision()).rejects.toThrow('install failed');
});
