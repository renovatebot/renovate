import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';

export const ReleaseResultZod = z.object({
  releases: z.array(
    z
      .object({
        version: z.string(),
        isDeprecated: z.boolean().optional(),
        releaseTimestamp: MaybeTimestamp,
        sourceUrl: z.string().optional(),
        sourceDirectory: z.string().optional(),
        changelogUrl: z.string().optional(),
        digest: z.string().optional(),
        isStable: z.boolean().optional(),
      })
      .transform((input) => {
        return {
          ...input,
          newDigest: input.digest,
          digest: undefined,
        };
      }),
  ),
  tags: z.record(z.string(), z.string()).optional(),
  sourceUrl: z.string().optional(),
  sourceDirectory: z.string().optional(),
  changelogUrl: z.string().optional(),
  homepage: z.string().optional(),
});
