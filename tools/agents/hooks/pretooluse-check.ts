import { deny } from './utils/output.ts';
import { PreToolUseHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

const raw = await readStdin();
const result = PreToolUseHookInput.safeParse(JSON.parse(raw));

if (!result.success) {
  process.exit(0);
}

const input = result.data;

if (input.tool_name === 'Bash') {
  const { command } = input.tool_input;
  if (/(?:^|\s)(?:npm|npx|yarn)(?:\s|$)/.test(command)) {
    deny('Use pnpm instead of npm/npx/yarn');
  }
}
