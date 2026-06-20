import { z } from 'zod/v4';

export const GitlabCommit = z.object({
  id: z.string(),
  created_at: z.string().optional(),
});
export type GitlabCommit = z.infer<typeof GitlabCommit>;

export const GitlabCommits = z.array(GitlabCommit);
export type GitlabCommits = z.infer<typeof GitlabCommits>;

export const GitlabTag = z.object({
  name: z.string(),
  commit: z
    .object({
      created_at: z.string().optional(),
    })
    .optional(),
});
export type GitlabTag = z.infer<typeof GitlabTag>;

export const GitlabTags = z.array(GitlabTag);
