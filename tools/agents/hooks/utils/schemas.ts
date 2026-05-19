import { z } from 'zod/v3';

// Common fields present on all hook events
const BaseHookInput = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  hook_event_name: z.string(),
});

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
