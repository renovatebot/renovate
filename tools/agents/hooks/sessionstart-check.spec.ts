// https://code.claude.com/docs/en/hooks#sessionstart

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));
const errorSpy = vi.spyOn(console, 'error');

beforeEach(() => {
  vi.resetModules();
  exec.mockReset();
  errorSpy.mockReset();
});

it('runs mise install then pnpm install on success', async () => {
  exec.mockResolvedValue(undefined);

  await import('./sessionstart-check.ts');

  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenNthCalledWith(1, 'mise', ['install']);
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install']);
});

it('skips mise failure gracefully and still runs pnpm install', async () => {
  exec
    .mockRejectedValueOnce(new Error('mise not found'))
    .mockResolvedValueOnce(undefined);

  await import('./sessionstart-check.ts');

  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenNthCalledWith(2, 'pnpm', ['install']);
  expect(errorSpy).toHaveBeenCalledWith(
    'mise is not installed or failed — skipping',
  );
});

it('propagates error if pnpm install fails', async () => {
  exec
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('install failed'));

  await expect(import('./sessionstart-check.ts')).rejects.toThrow(
    'install failed',
  );
});
