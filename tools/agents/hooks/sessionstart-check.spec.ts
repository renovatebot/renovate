// https://code.claude.com/docs/en/hooks#sessionstart
import { SessionStartHookInput } from './utils/schemas.ts';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('./utils/exec.ts', () => ({ exec }));
const errorSpy = vi.spyOn(console, 'error');

const sessionStartHookInput = SessionStartHookInput.parse({
  session_id: 'test-session',
  transcript_path: '/tmp/transcript.jsonl',
  cwd: '/Users/test/renovate',
  hook_event_name: 'SessionStart',
  source: 'startup',
  model: 'claude-sonnet-4-6',
});

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

it('documents the SessionStart hook input shape', () => {
  expect(sessionStartHookInput).toMatchObject({
    session_id: expect.any(String),
    transcript_path: expect.any(String),
    cwd: expect.any(String),
    hook_event_name: 'SessionStart',
    source: expect.any(String),
    model: expect.any(String),
  });
});
