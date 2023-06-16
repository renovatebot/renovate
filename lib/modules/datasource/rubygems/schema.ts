import is from '@sindresorhus/is';
import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import type { Release } from '../types';

export const MarshalledVersionInfo = LooseArray(
  z
    .object({
      number: z.string(),
    })
    .transform(({ number: version }) => ({ version }))
)
  .transform((releases) => (releases.length === 0 ? null : { releases }))
  .nullable()
  .catch(null);

export const GemMetadata = z
  .object({
    name: z.string().transform((x) => x.toLowerCase()),
    version: z.string().nullish().catch(null),
    changelog_uri: z.string().nullish().catch(null),
    homepage_uri: z.string().nullish().catch(null),
    source_code_uri: z.string().nullish().catch(null),
  })
  .transform(
    ({
      name: packageName,
      version,
      changelog_uri: changelogUrl,
      homepage_uri: homepage,
      source_code_uri: sourceUrl,
    }) => ({
      packageName,
      latestVersion: version,
      changelogUrl,
      homepage,
      sourceUrl,
    })
  );
export type GemMetadata = z.infer<typeof GemMetadata>;

export const GemVersions = LooseArray(
  z
    .object({
      number: z.string(),
      created_at: z.string(),
      platform: z.string().nullable().catch(null),
      ruby_version: z.string().nullable().catch(null),
      rubygems_version: z.string().nullable().catch(null),
    })
    .transform(
      ({
        number: version,
        created_at: releaseTimestamp,
        platform,
        ruby_version: rubyVersion,
        rubygems_version: rubygemsVersion,
      }): Release => {
        const result: Release = { version, releaseTimestamp };
        const constraints: Record<string, string[]> = {};

        if (platform) {
          constraints.platform = [platform];
        }

        if (rubyVersion) {
          constraints.ruby = [rubyVersion];
        }

        if (rubygemsVersion) {
          constraints.rubygems = [rubygemsVersion];
        }

        if (!is.emptyObject(constraints)) {
          result.constraints = constraints;
        }

        return result;
      }
    )
);
export type GemVersions = z.infer<typeof GemVersions>;
