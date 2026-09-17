import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const ReleaseResultZod = z.object({
  releases: z.array(
    z
      .object({
        version: z.string(),
        isDeprecated: z.boolean().optional(),
        releaseTimestamp: MaybeTimestamp,
        sourceUrl: z.string().optional(),
        sourceDirectory: z.string().optional(),
        // Release notes are cosmetic, so malformed content must not discard the
        // whole lookup and block updates for the package.
        changelogContent: z.string().optional().catch(undefined),
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
