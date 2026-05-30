import { z } from 'zod/v4';

export const GitlabProjectSchema = z.object({
  default_branch: z.string().optional().nullable(),
});
export type GitlabProject = z.infer<typeof GitlabProjectSchema>;
