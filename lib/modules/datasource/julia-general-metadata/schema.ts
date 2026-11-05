import { z } from 'zod/v4';
import { LooseRecord } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release, ReleaseResult } from '../types.ts';

export const JuliaPackageMetadata = LooseRecord(
  z.string(),
  z.object({
    registered: MaybeTimestamp.optional(),
    yanked: z.string().optional(),
  }),
)
  .refine((versions) => Object.keys(versions).length > 0, 'No releases found')
  .transform((versions): ReleaseResult => {
    const releases: Release[] = Object.entries(versions).map(
      ([version, info]): Release => {
        const release: Release = { version };
        if (info.registered) {
          release.releaseTimestamp = info.registered;
        }
        if (info.yanked) {
          release.isDeprecated = true;
        }
        return release;
      },
    );
    return { releases };
  });
