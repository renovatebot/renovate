import { deny } from './utils/output.ts';
import { PreToolUseHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

const raw = await readStdin();
// oxlint-disable-next-line renovate/prefer-json-pipe -- hook scripts must stay dependency-light and fast to start; `Json` lives in lib/util/schema-utils, which drags in the full lib import graph (logger, yaml, toml)
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
