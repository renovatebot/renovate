// https://code.claude.com/docs/en/hooks#stop
import { Json } from '../../../lib/util/schema-utils/index.ts';
import { BlockOutput } from './utils/schemas.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));

const { getChangedFiles } = vi.hoisted(() => ({
  getChangedFiles: vi.fn<() => Promise<string[]>>(),
}));
vi.mock('./utils/git.ts', () => ({ getChangedFiles }));

const consoleSpy = vi.spyOn(console, 'log');
const stderrSpy = vi
  .spyOn(process.stderr, 'write')
  .mockImplementation(() => true);

beforeEach(() => {
  vi.resetModules();
});

it('runs pnpm check --all with changed files', async () => {
  getChangedFiles.mockResolvedValue(['lib/foo.ts', 'lib/bar.ts']);
  exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });

  await import('./stop-check.ts');

  expect(exec).toHaveBeenCalledWith(
    'pnpm',
    ['check', '--all', 'lib/foo.ts', 'lib/bar.ts'],
    { stdout: 'pipe', stderr: 'pipe', all: true, reject: false },
  );
  expect(stderrSpy).toHaveBeenCalledWith('Checks: ok');
  expect(consoleSpy).not.toHaveBeenCalled();
});

it('does not run pnpm check --all when no files changed', async () => {
  getChangedFiles.mockResolvedValue([]);

  await import('./stop-check.ts');

  expect(exec).not.toHaveBeenCalled();
  expect(consoleSpy).not.toHaveBeenCalled();
});

const blockHeader =
  'pnpm check --all failed — the issues must be resolved before finishing\n\n';

it('outputs block JSON with the check output when pnpm check --all fails', async () => {
  getChangedFiles.mockResolvedValue(['lib/foo.ts']);
  exec.mockResolvedValue({ failed: true, all: 'oxlint ✗' });

  await import('./stop-check.ts');

  expect(consoleSpy).toHaveBeenCalledOnce();
  const output = Json.pipe(BlockOutput).parse(consoleSpy.mock.calls[0][0]);
  expect(output).toEqual({
    decision: 'block',
    reason: `${blockHeader}oxlint ✗`,
  });
});

it('keeps only the start and the end of a long check output with a truncation hint', async () => {
  getChangedFiles.mockResolvedValue(['lib/foo.ts']);
  exec.mockResolvedValue({
    failed: true,
    all: `${'a'.repeat(6_000)}${'b'.repeat(6_000)}`,
  });

  await import('./stop-check.ts');

  const output = Json.pipe(BlockOutput).parse(consoleSpy.mock.calls[0][0]);
  expect(output.reason).toBe(
    `${blockHeader}${'a'.repeat(5_000)}\n[… 2000 characters truncated, run \`pnpm check --all <files>\` on the affected files for the full output …]\n${'b'.repeat(5_000)}`,
  );
});
