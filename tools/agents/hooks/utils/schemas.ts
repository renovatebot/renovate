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

// https://code.claude.com/docs/en/hooks#pretooluse
export const PreToolUseBashInput = BaseHookInput.extend({
  hook_event_name: z.literal('PreToolUse'),
  tool_use_id: z.string(),
  tool_name: z.literal('Bash'),
  tool_input: z.object({
    command: z.string(),
    description: z.string().optional(),
    timeout: z.number().optional(),
    run_in_background: z.boolean().optional(),
  }),
});
