import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

/**
 * Response of `GET /v1/packages/{owner}/{repo}/versions` of the APM registry
 * HTTP API. `versions[]` is required but may be empty; `published_at` is
 * required by the spec, but clients must not depend on it.
 *
 * https://microsoft.github.io/apm/reference/registry-http-api/#31-get-v1packagesownerrepoversions--list-versions
 */
export const ApmPackageVersions = z
  .object({
    versions: LooseArray(
      z.object({
        version: z.string(),
        published_at: MaybeTimestamp.optional(),
      }),
    ),
  })
  .transform(({ versions }): Release[] =>
    versions.map(({ version, published_at }) => ({
      version,
      ...(published_at && { releaseTimestamp: published_at }),
    })),
  );
