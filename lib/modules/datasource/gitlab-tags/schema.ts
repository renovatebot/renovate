import { z } from 'zod/v4';

export const GitlabCommitSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
});
export type GitlabCommit = z.infer<typeof GitlabCommitSchema>;

export const GitlabTagSchema = z.object({
  name: z.string(),
  commit: z
    .object({
      created_at: z.string().optional(),
    })
    .optional(),
});
export type GitlabTag = z.infer<typeof GitlabTagSchema>;

export const GitlabTagsSchema = z.array(GitlabTagSchema);
