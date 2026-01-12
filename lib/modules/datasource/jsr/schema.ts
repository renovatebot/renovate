import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { Release } from '../types';

/**
 * In the JSR.io API, if a package has had any version published on or after 2025-09-18,
 * the createdAt field will be returned for all versions of that package, including historical ones.
 * If a package has not been published at all since this date,
 * the createdAt field will be omitted entirely from the API response.
 * Therefore, we can assume that it published no less than that date for older versions
 * https://github.com/jsr-io/jsr/pull/1194#issuecomment-3522729482
 */
export const MINIMUM_RELEASE_TIMESTAMP = MaybeTimestamp.parse(
  '2025-09-18T00:00:00.000Z',
);

// https://github.com/jsr-io/jsr/blob/b8d753f4ed96f032bc494e8809065cfe8df5c641/api/src/metadata.rs#L30-L35
export const JsrPackageMetadata = z
  .object({
    latest: z.string().optional(),
    versions: z.record(
      z.string(),
      z.object({
        createdAt: MaybeTimestamp,
        yanked: z.boolean().optional(),
      }),
    ),
  })
  .transform(({ versions, latest }): Release[] => {
    return Object.entries(versions).map(([version, val]) => ({
      version,
      ...{
        releaseTimestamp: val.createdAt ?? MINIMUM_RELEASE_TIMESTAMP,
      },
      ...(val.yanked && { isDeprecated: true }),
      ...(latest === version && { isLatest: true }),
    }));
  });
