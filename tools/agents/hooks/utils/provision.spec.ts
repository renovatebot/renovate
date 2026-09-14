import { provision } from './provision.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./exec.ts', () => ({ exec }));
const errorSpy = vi.spyOn(console, 'error');

it('runs mise install then pnpm install', async () => {
  exec.mockResolvedValue(undefined);

  await provision();

  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenNthCalledWith(1, 'mise', ['install'], {});
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install'], {});
});

it('passes cwd to both commands when provided', async () => {
  exec.mockResolvedValue(undefined);

  await provision('/some/worktree');

  expect(exec).toHaveBeenNthCalledWith(1, 'mise', ['install'], {
    cwd: '/some/worktree',
  });
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install'], {
    cwd: '/some/worktree',
  });
});

it('skips mise failure gracefully and still runs pnpm install', async () => {
  exec
    .mockRejectedValueOnce(new Error('mise not found'))
    .mockResolvedValueOnce(undefined);

  await provision();

  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install'], {});
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
