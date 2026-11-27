import type { PreToolUseDenyOutput } from './schemas.ts';

export function deny(reason: string): void {
  const output: PreToolUseDenyOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  console.log(JSON.stringify(output));
}
