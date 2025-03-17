import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';

export type GalaxyV1 = z.infer<typeof GalaxyV1>;
export const GalaxyV1 = z.object({
  results: z.array(
    z.object({
      summary_fields: z.object({
        versions: z.array(
          z
            .object({
              name: z.string(),
              created: MaybeTimestamp,
            })
            .transform(({ name, created }) => ({
              version: name,
              releaseTimestamp: created,
            })),
        ),
      }),
      github_user: z.string().optional(),
      github_repo: z.string().optional(),
    }),
  ),
});
