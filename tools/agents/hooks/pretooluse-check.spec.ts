// https://code.claude.com/docs/en/hooks#pretooluse

const { deny } = vi.hoisted(() => ({ deny: vi.fn() }));
vi.mock('./utils/output.ts', () => ({ deny }));

const { readStdin } = vi.hoisted(() => ({ readStdin: vi.fn() }));
vi.mock('./utils/stdin.ts', () => ({ readStdin }));

function makeInput(
  toolName: string,
  toolInput: Record<string, unknown>,
): string {
  return JSON.stringify({
    session_id: 'test-session',
    transcript_path: '/tmp/transcript.jsonl',
    cwd: '/Users/test/renovate',
    hook_event_name: 'PreToolUse',
    tool_use_id: 'tu-123',
    tool_name: toolName,
    tool_input: toolInput,
  });
}

beforeEach(() => {
  vi.resetModules();
});

it('blocks npm install', async () => {
  readStdin.mockResolvedValue(makeInput('Bash', { command: 'npm install' }));
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
  expect(deny).toHaveBeenCalledWith('Use pnpm instead of npm/npx/yarn');
});

it('blocks npx create-react-app', async () => {
  readStdin.mockResolvedValue(
    makeInput('Bash', { command: 'npx create-react-app my-app' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
});

it('blocks yarn add foo', async () => {
  readStdin.mockResolvedValue(makeInput('Bash', { command: 'yarn add foo' }));
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
});

it('blocks chained command with npm', async () => {
  readStdin.mockResolvedValue(
    makeInput('Bash', { command: 'echo hi && npm test' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
});

it.each`
  command
  ${'echo hi; yarn add foo'}
  ${'ls || npx foo'}
  ${'cat package.json | npx json'}
  ${'(npm test)'}
  ${'echo $(npm bin)'}
  ${'echo `npm bin`'}
  ${'echo hi\nnpm test'}
  ${'CI=1 npm test'}
  ${'  npm test'}
`('blocks $command', async ({ command }) => {
  readStdin.mockResolvedValue(makeInput('Bash', { command }));
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledExactlyOnceWith(
    'Use pnpm instead of npm/npx/yarn',
  );
});

it.each`
  command
  ${"gh pr comment 1 --body 'documented by npm, see the npm docs'"}
  ${'git commit -m "fix: support yarn workspaces"'}
  ${'pnpm vitest lib/modules/manager/npm'}
  ${'pnpm exec tsx tools/foo.ts --manager npm'}
`('allows $command, which only mentions the tool', async ({ command }) => {
  readStdin.mockResolvedValue(makeInput('Bash', { command }));
  await import('./pretooluse-check.ts');
  expect(deny).not.toHaveBeenCalled();
});

it('allows pnpm install', async () => {
  readStdin.mockResolvedValue(makeInput('Bash', { command: 'pnpm install' }));
  await import('./pretooluse-check.ts');
  expect(deny).not.toHaveBeenCalled();
});

it('allows non-Bash tool', async () => {
  readStdin.mockResolvedValue(
    makeInput('Read', { file_path: '/some/file.ts' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).not.toHaveBeenCalled();
});

it('allows a command that contains npm as a substring but is not standalone', async () => {
  readStdin.mockResolvedValue(
    makeInput('Bash', { command: 'cat package.json | jq .npmClient' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).not.toHaveBeenCalled();
});

it('blocks pnpm jest', async () => {
  readStdin.mockResolvedValue(makeInput('Bash', { command: 'pnpm jest' }));
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
  expect(deny).toHaveBeenCalledWith('Use pnpm vitest instead of pnpm jest');
});

it('blocks pnpm run jest with args', async () => {
  readStdin.mockResolvedValue(
    makeInput('Bash', { command: 'pnpm run jest lib/foo.spec.ts' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
  expect(deny).toHaveBeenCalledWith('Use pnpm vitest instead of pnpm jest');
});

it('blocks pnpm exec jest', async () => {
  readStdin.mockResolvedValue(makeInput('Bash', { command: 'pnpm exec jest' }));
  await import('./pretooluse-check.ts');
  expect(deny).toHaveBeenCalledOnce();
  expect(deny).toHaveBeenCalledWith('Use pnpm vitest instead of pnpm jest');
});

it('allows pnpm vitest', async () => {
  readStdin.mockResolvedValue(
    makeInput('Bash', { command: 'pnpm vitest lib/foo.spec.ts' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).not.toHaveBeenCalled();
});

it('allows command containing jest as substring but not standalone', async () => {
  readStdin.mockResolvedValue(
    makeInput('Bash', { command: 'cat package.json | jq .jestConfig' }),
  );
  await import('./pretooluse-check.ts');
  expect(deny).not.toHaveBeenCalled();
});
