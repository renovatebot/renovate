import type { BlockOutput, PreToolUseDenyOutput } from './schemas.ts';

export function block(reason: string): void {
  const output: BlockOutput = { decision: 'block', reason };
  console.log(JSON.stringify(output));
}

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
