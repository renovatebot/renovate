import { z } from 'zod/v4';

export const GitlabRelease = z.object({
  description: z.string().optional().nullable(),
  name: z.string().optional().default(''),
  tag_name: z.string(),
  released_at: z.string(),
});
export type GitlabRelease = z.infer<typeof GitlabRelease>;

export const GitlabReleases = z.array(GitlabRelease);
