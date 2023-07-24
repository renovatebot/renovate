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
).refine(
  (value) => !is.emptyArray(value),
  'Empty response from `/v1/dependencies` endpoint'
);

export const GemMetadata = z
  .object({
    name: z.string(),
    version: z.string().optional().catch(undefined),
    changelog_uri: z.string().optional().catch(undefined),
    homepage_uri: z.string().optional().catch(undefined),
    source_code_uri: z.string().optional().catch(undefined),
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
      platform: z.string().optional().catch(undefined),
      ruby_version: z.string().optional().catch(undefined),
      rubygems_version: z.string().optional().catch(undefined),
      metadata: z
        .object({
          changelog_uri: z.string().optional().catch(undefined),
          source_code_uri: z.string().optional().catch(undefined),
        })
        .catch({}),
    })
    .transform(
      ({
        number: version,
        created_at: releaseTimestamp,
        platform,
        ruby_version: rubyVersion,
        rubygems_version: rubygemsVersion,
        metadata,
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

        if (metadata.changelog_uri) {
          result.changelogUrl = metadata.changelog_uri;
        }

        if (metadata.source_code_uri) {
          result.sourceUrl = metadata.source_code_uri;
        }

        return result;
      }
    )
);
export type GemVersions = z.infer<typeof GemVersions>;
