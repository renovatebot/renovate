// https://code.claude.com/docs/en/hooks#stop
import { Json } from '../../../lib/util/schema-utils/index.ts';
import { BlockOutput } from './utils/schemas.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));

const { getBaseRef, getChangedFiles, getDeletedFiles } = vi.hoisted(() => ({
  getBaseRef: vi.fn<() => Promise<string>>(),
  getChangedFiles: vi.fn<(baseRef: string) => Promise<string[]>>(),
  getDeletedFiles: vi.fn<(baseRef: string) => Promise<string[]>>(),
}));
vi.mock('./utils/git.ts', () => ({
  getBaseRef,
  getChangedFiles,
  getDeletedFiles,
}));

const { readStdin } = vi.hoisted(() => ({ readStdin: vi.fn() }));
vi.mock('./utils/stdin.ts', () => ({ readStdin }));

const { readFile, writeFile, mkdir } = vi.hoisted(() => ({
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, data: string) => Promise<void>>(),
  mkdir: vi.fn(),
}));
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile,
  writeFile,
  mkdir,
}));

const consoleSpy = vi.spyOn(console, 'log');
const stderrSpy = vi
  .spyOn(process.stderr, 'write')
  .mockImplementation(() => true);

const fingerprintFile = '.cache/stop-hook/fingerprint';
const checkArgs = [
  'check',
  '--all',
  '--coverage-dir=.cache/stop-hook/coverage',
];
const execOptions = {
  stdout: 'pipe',
  stderr: 'pipe',
  all: true,
  reject: false,
};

let files: Record<string, string>;

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

async function runHook(): Promise<void> {
  vi.resetModules();
  await import('./stop-check.ts');
}

describe('tools/agents/hooks/stop-check', () => {
  beforeEach(() => {
    files = { 'lib/foo.ts': 'foo', 'lib/bar.ts': 'bar' };
    readFile.mockImplementation((path) => {
      if (!(path in files)) {
        return Promise.reject(new Error(`ENOENT: ${path}`));
      }
      return Promise.resolve(files[path]);
    });
    writeFile.mockImplementation((path, data) => {
      files[path] = data;
      return Promise.resolve();
    });
    readStdin.mockResolvedValue(makeInput());
    getBaseRef.mockResolvedValue('abc1234');
    getDeletedFiles.mockResolvedValue([]);
  });

  it('runs pnpm check --all with the coverage directory and the changed files', async () => {
    getChangedFiles.mockResolvedValue(['lib/foo.ts', 'lib/bar.ts']);
    exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });

    await runHook();

    expect(getChangedFiles).toHaveBeenCalledWith('abc1234');
    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      [...checkArgs, 'lib/foo.ts', 'lib/bar.ts'],
      execOptions,
    );
    expect(stderrSpy).toHaveBeenCalledWith('Checks: ok');
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(mkdir).toHaveBeenCalledWith('.cache/stop-hook', { recursive: true });
    expect(files[fingerprintFile]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not run pnpm check --all when no files changed', async () => {
    getChangedFiles.mockResolvedValue([]);

    await runHook();

    expect(exec).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not run pnpm check --all when stop_hook_active is true', async () => {
    readStdin.mockResolvedValue(makeInput(true));

    await runHook();

    expect(getChangedFiles).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('still runs the check when the input does not parse as a Stop hook input', async () => {
    readStdin.mockResolvedValue(JSON.stringify({ hook_event_name: 'Stop' }));
    getChangedFiles.mockResolvedValue(['lib/foo.ts']);
    exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });

    await runHook();

    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      [...checkArgs, 'lib/foo.ts'],
      execOptions,
    );
  });

  it('does not run pnpm check --all again when the changed files are unchanged since the last passed check', async () => {
    getChangedFiles.mockResolvedValue(['lib/foo.ts']);
    exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });
    await runHook();
    exec.mockClear();

    await runHook();

    expect(exec).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it.each`
    change                 | baseRef      | changedFiles                    | content
    ${'a file content'}    | ${'abc1234'} | ${['lib/foo.ts']}               | ${'changed'}
    ${'the changed files'} | ${'abc1234'} | ${['lib/foo.ts', 'lib/bar.ts']} | ${'foo'}
    ${'the base ref'}      | ${'def5678'} | ${['lib/foo.ts']}               | ${'foo'}
  `(
    'runs pnpm check --all again when $change changed since the last passed check',
    async ({
      baseRef,
      changedFiles,
      content,
    }: {
      baseRef: string;
      changedFiles: string[];
      content: string;
    }) => {
      getChangedFiles.mockResolvedValue(['lib/foo.ts']);
      exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });
      await runHook();
      exec.mockClear();
      getBaseRef.mockResolvedValue(baseRef);
      getChangedFiles.mockResolvedValue(changedFiles);
      files['lib/foo.ts'] = content;

      await runHook();

      expect(exec).toHaveBeenCalledWith(
        'pnpm',
        [...checkArgs, ...changedFiles],
        execOptions,
      );
    },
  );

  it('runs pnpm check --all again when a file was deleted since the last passed check', async () => {
    getChangedFiles.mockResolvedValue(['lib/foo.ts']);
    exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });
    await runHook();
    exec.mockClear();
    getDeletedFiles.mockResolvedValue(['lib/old.ts']);

    await runHook();

    expect(getDeletedFiles).toHaveBeenCalledWith('abc1234');
    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      [...checkArgs, 'lib/foo.ts'],
      execOptions,
    );
  });

  it('stores the fingerprint of the files as they are after the check', async () => {
    getChangedFiles.mockResolvedValue(['lib/foo.ts']);
    exec.mockImplementation(() => {
      files['lib/foo.ts'] = 'fixed';
      return Promise.resolve({ failed: false, all: 'Checks: ok' });
    });
    await runHook();
    exec.mockClear();

    await runHook();

    expect(exec).not.toHaveBeenCalled();
  });

  it('does not store a fingerprint when pnpm check --all fails', async () => {
    getChangedFiles.mockResolvedValue(['lib/foo.ts']);
    exec.mockResolvedValue({ failed: true, all: 'oxlint ✗' });
    await runHook();

    expect(writeFile).not.toHaveBeenCalled();

    await runHook();

    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('runs pnpm check --all without storing a fingerprint when a changed file cannot be read', async () => {
    getChangedFiles.mockResolvedValue(['lib/missing.ts']);
    exec.mockResolvedValue({ failed: false, all: 'Checks: ok' });

    await runHook();

    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      [...checkArgs, 'lib/missing.ts'],
      execOptions,
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  const blockHeader =
    'pnpm check --all failed — the issues must be resolved before finishing\n\n';

  it('outputs block JSON with the check output when pnpm check --all fails', async () => {
    getChangedFiles.mockResolvedValue(['lib/foo.ts']);
    exec.mockResolvedValue({ failed: true, all: 'oxlint ✗' });

    await runHook();

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

    await runHook();

    const output = Json.pipe(BlockOutput).parse(consoleSpy.mock.calls[0][0]);
    expect(output.reason).toBe(
      `${blockHeader}${'a'.repeat(5_000)}\n[… 2000 characters truncated, run \`pnpm check --all <files>\` on the affected files for the full output …]\n${'b'.repeat(5_000)}`,
    );
  });
});
