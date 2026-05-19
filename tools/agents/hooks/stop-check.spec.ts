// https://code.claude.com/docs/en/hooks#stop
import { BlockOutput } from './utils/schemas.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));
const consoleSpy = vi.spyOn(console, 'log');

beforeEach(() => {
  vi.resetModules();
  exec.mockReset();
  consoleSpy.mockReset();
});

it('runs lint-fix and test successfully without any output', async () => {
  exec.mockResolvedValue(undefined);
  await import('./stop-check.ts');

  expect(exec).toHaveBeenCalledWith('pnpm', ['lint-fix']);
  expect(exec).toHaveBeenCalledWith('pnpm', ['test']);
  expect(consoleSpy).not.toHaveBeenCalled();
});

it('outputs block JSON when pnpm lint-fix fails', async () => {
  exec
    .mockRejectedValueOnce(new Error('lint failed'))
    .mockResolvedValueOnce(undefined);

  await import('./stop-check.ts');

  expect(consoleSpy).toHaveBeenCalledOnce();
  const output = BlockOutput.parse(JSON.parse(consoleSpy.mock.calls[0][0]));
  expect(output).toEqual({
    decision: 'block',
    reason:
      'pnpm lint-fix failed — the issues must be resolved before finishing',
  });
});

it('outputs block JSON when pnpm test fails', async () => {
  exec
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('test failed'));

  await import('./stop-check.ts');

  expect(consoleSpy).toHaveBeenCalledOnce();
  const output = BlockOutput.parse(JSON.parse(consoleSpy.mock.calls[0][0]));
  expect(output).toEqual({
    decision: 'block',
    reason: 'pnpm test failed — the issues must be resolved before finishing',
  });
});

it('outputs two block JSONs when both lint-fix and test fail', async () => {
  exec
    .mockRejectedValueOnce(new Error('lint failed'))
    .mockRejectedValueOnce(new Error('test failed'));

  await import('./stop-check.ts');

  expect(consoleSpy).toHaveBeenCalledTimes(2);
  const first = BlockOutput.parse(JSON.parse(consoleSpy.mock.calls[0][0]));
  const second = BlockOutput.parse(JSON.parse(consoleSpy.mock.calls[1][0]));
  expect(first).toEqual({
    decision: 'block',
    reason:
      'pnpm lint-fix failed — the issues must be resolved before finishing',
  });
  expect(second).toEqual({
    decision: 'block',
    reason: 'pnpm test failed — the issues must be resolved before finishing',
  });
});
