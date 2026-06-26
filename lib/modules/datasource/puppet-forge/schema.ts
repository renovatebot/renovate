import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release, ReleaseResult } from '../types.ts';

export const PuppetReleaseAbbreviated = z
  .object({
    version: z.string(),
    created_at: MaybeTimestamp,
    file_uri: z.string().optional().nullable(),
  })
  .transform(({ version, created_at, file_uri }): Release => {
    const release: Release = { version };
    if (file_uri) {
      release.downloadUrl = file_uri;
    }
    if (created_at) {
      release.releaseTimestamp = created_at;
    }
    return release;
  });

export const PuppetModule = z
  .object({
    releases: LooseArray(PuppetReleaseAbbreviated).default([]),
    homepage_url: z.string().optional().nullable(),
    deprecated_for: z.string().optional().nullable(),
  })
  .transform((module): ReleaseResult => {
    const result: ReleaseResult = { releases: module.releases };
    if (module.homepage_url) {
      result.homepage = module.homepage_url;
    }
    if (module.deprecated_for) {
      result.deprecationMessage = module.deprecated_for;
    }
    return result;
  });
