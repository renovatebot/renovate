import { deny } from './utils/output.ts';
import { PreToolUseHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

// the tool in command position: at the start, or after a separator, a subshell or leading variable assignments,
// so that the word inside an argument, such as a quoted comment body, is not mistaken for a command
const forbiddenToolRegex =
  /(?:^|[;&|(`\n])\s*(?:\w+=\S*\s+)*(?:npm|npx|yarn)(?:\s|$)/;

const raw = await readStdin();
// oxlint-disable-next-line renovate/prefer-json-pipe -- hook scripts must stay dependency-light and fast to start; `Json` lives in lib/util/schema-utils, which drags in the full lib import graph (logger, yaml, toml)
const result = PreToolUseHookInput.safeParse(JSON.parse(raw));

if (result.success) {
  const parsed = result.data;

  if (parsed.tool_name === 'Bash') {
    const { command } = parsed.tool_input;
    if (forbiddenToolRegex.test(command)) {
      deny('Use pnpm instead of npm/npx/yarn');
    }
    if (/(?:^|\s)pnpm\s+(?:run\s+|exec\s+)?jest(?:\s|$)/.test(command)) {
      deny('Use pnpm vitest instead of pnpm jest');
    }
  }
}
