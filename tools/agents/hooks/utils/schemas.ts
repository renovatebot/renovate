import { z } from 'zod/v4';

// Common fields present on all hook events
const BaseHookInput = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  hook_event_name: z.string(),
});

// CwdChanged hook input
// https://code.claude.com/docs/en/hooks#cwdchanged
export const CwdChangedHookInput = BaseHookInput.extend({
  hook_event_name: z.literal('CwdChanged'),
});
export type CwdChangedHookInput = z.infer<typeof CwdChangedHookInput>;

// SessionStart hook input
// https://code.claude.com/docs/en/hooks#sessionstart
export const SessionStartHookInput = BaseHookInput.extend({
  hook_event_name: z.literal('SessionStart'),
  source: z.enum(['startup', 'resume', 'clear', 'compact']),
  model: z.string(),
});
export type SessionStartHookInput = z.infer<typeof SessionStartHookInput>;

// Stop hook input
// https://code.claude.com/docs/en/hooks#stop
export const StopHookInput = BaseHookInput.extend({
  hook_event_name: z.literal('Stop'),
  permission_mode: z.enum([
    'default',
    'plan',
    'acceptEdits',
    'auto',
    'dontAsk',
    'bypassPermissions',
  ]),
});
export type StopHookInput = z.infer<typeof StopHookInput>;

// Block output (used by Stop hooks to prevent stopping)
// https://code.claude.com/docs/en/hooks#stop
export const BlockOutput = z.object({
  decision: z.literal('block'),
  reason: z.string(),
});
export type BlockOutput = z.infer<typeof BlockOutput>;

// https://code.claude.com/docs/en/hooks#pretooluse
const PreToolUseBaseInput = BaseHookInput.extend({
  hook_event_name: z.literal('PreToolUse'),
  tool_use_id: z.string(),
});

export const PreToolUseBashInput = PreToolUseBaseInput.extend({
  tool_name: z.literal('Bash'),
  tool_input: z.object({
    command: z.string(),
    description: z.string().optional(),
    timeout: z.number().optional(),
    run_in_background: z.boolean().optional(),
  }),
});
export type PreToolUseBashInput = z.infer<typeof PreToolUseBashInput>;

export const PreToolUseHookInput = z.discriminatedUnion('tool_name', [
  PreToolUseBashInput,
]);
export type PreToolUseHookInput = z.infer<typeof PreToolUseHookInput>;

// Deny output (used by PreToolUse hooks to block tool calls)
// https://code.claude.com/docs/en/hooks#pretooluse
export const PreToolUseDenyOutput = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('PreToolUse'),
    permissionDecision: z.literal('deny'),
    permissionDecisionReason: z.string(),
  }),
});
export type PreToolUseDenyOutput = z.infer<typeof PreToolUseDenyOutput>;
