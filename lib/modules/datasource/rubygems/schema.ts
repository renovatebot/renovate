import { isEmptyArray, isEmptyObject } from '@sindresorhus/is';
import { z } from 'zod/v3';
import { filterMap } from '../../../util/filter-map.ts';
import { newlineRegex } from '../../../util/regex.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

export const MarshalledVersionInfo = LooseArray(
  z
    .object({ number: z.string() })
    .transform(({ number: version }): Release => ({ version })),
)
  .refine(
    (value) => !isEmptyArray(value),
    'Empty response from `/v1/dependencies` endpoint',
  )
  .transform((releases) => ({ releases }));
type MarshalledVersionInfo = z.infer<typeof MarshalledVersionInfo>;

export const GemMetadata = z
  .object({
    changelog_uri: z.string().optional().catch(undefined),
    homepage_uri: z.string().optional().catch(undefined),
    source_code_uri: z.string().optional().catch(undefined),
  })
  .transform(
    ({
      changelog_uri: changelogUrl,
      homepage_uri: homepage,
      source_code_uri: sourceUrl,
    }) => ({ changelogUrl, homepage, sourceUrl }),
  );
export type GemMetadata = z.infer<typeof GemMetadata>;

export const GemVersions = LooseArray(
  z
    .object({
      number: z.string(),
      created_at: MaybeTimestamp,
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

        if (!isEmptyObject(constraints)) {
          result.constraints = constraints;
        }

        if (metadata.changelog_uri) {
          result.changelogUrl = metadata.changelog_uri;
        }

        if (metadata.source_code_uri) {
          result.sourceUrl = metadata.source_code_uri;
        }

        return result;
      },
    ),
)
  .refine(
    (value) => !isEmptyArray(value),
    'Empty response from `/v1/gems` endpoint',
  )
  .transform((releases) => ({ releases }));
export type GemVersions = z.infer<typeof GemVersions>;

export const GemInfo = z
  .string()
  .transform((body) =>
    filterMap(body.split(newlineRegex), (line) => {
      const spaceIdx = line.indexOf(' ');
      return spaceIdx > 0 ? line.slice(0, spaceIdx) : null;
    }).map((version): Release => ({ version })),
  )
  .refine(
    (value) => !isEmptyArray(value),
    'Empty response from `/info` endpoint',
  )
  .transform((releases) => ({ releases }));
export type GemInfo = z.infer<typeof GemInfo>;
