import { deny } from './utils/output.ts';
import { PreToolUseHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

const raw = await readStdin();
const result = PreToolUseHookInput.safeParse(JSON.parse(raw));

if (result.success) {
  const parsed = result.data;

  if (parsed.tool_name === 'Bash') {
    const { command } = parsed.tool_input;
    if (/(?:^|\s)(?:npm|npx|yarn)(?:\s|$)/.test(command)) {
      deny('Use pnpm instead of npm/npx/yarn');
    }
    if (/(?:^|\s)pnpm\s+(?:run\s+|exec\s+)?jest(?:\s|$)/.test(command)) {
      deny('Use pnpm vitest instead of pnpm jest');
    }
  }
}
