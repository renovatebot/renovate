// https://code.claude.com/docs/en/hooks#stop
import { Json } from '../../../lib/util/schema-utils/index.ts';
import { BlockOutput } from './utils/schemas.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));

const { getChangedFiles } = vi.hoisted(() => ({
  getChangedFiles: vi.fn<() => Promise<string[]>>(),
}));
vi.mock('./utils/git.ts', () => ({ getChangedFiles }));

const { readStdin } = vi.hoisted(() => ({ readStdin: vi.fn() }));
vi.mock('./utils/stdin.ts', () => ({ readStdin }));

const consoleSpy = vi.spyOn(console, 'log');
const stderrSpy = vi
  .spyOn(process.stderr, 'write')
  .mockImplementation(() => true);

function makeInput(stopHookActive?: boolean): string {
  return JSON.stringify({
    session_id: 'test-session',
    transcript_path: '/tmp/transcript.jsonl',
    cwd: '/Users/test/renovate',
    hook_event_name: 'Stop',
    permission_mode: 'default',
    ...(stopHookActive === undefined
      ? {}
      : { stop_hook_active: stopHookActive }),
  });
}

beforeEach(() => {
  vi.resetModules();
  readStdin.mockResolvedValue(makeInput());
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

it('does not run pnpm check --all when stop_hook_active is true', async () => {
  readStdin.mockResolvedValue(makeInput(true));

  await import('./stop-check.ts');

  expect(getChangedFiles).not.toHaveBeenCalled();
  expect(exec).not.toHaveBeenCalled();
  expect(consoleSpy).not.toHaveBeenCalled();
});

it('still runs the check when the input does not parse as a Stop hook input', async () => {
  readStdin.mockResolvedValue(JSON.stringify({ hook_event_name: 'Stop' }));
  getChangedFiles.mockResolvedValue(['lib/foo.ts']);
  exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });

  await import('./stop-check.ts');

  expect(exec).toHaveBeenCalledWith('pnpm', ['check', '--all', 'lib/foo.ts'], {
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
    reject: false,
  });
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
