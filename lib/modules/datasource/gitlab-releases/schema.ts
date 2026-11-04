import { z } from 'zod/v4';
import { DeepNullish } from '../../../util/schema-utils/index.ts';

export const GitlabRelease = DeepNullish(
  z.object({
    description: z.string().optional().default(''),
    name: z.string().optional().default(''),
    tag_name: z.string(),
    released_at: z.string(),
  }),
);
export type GitlabRelease = z.infer<typeof GitlabRelease>;

export const GitlabReleases = z.array(GitlabRelease);
