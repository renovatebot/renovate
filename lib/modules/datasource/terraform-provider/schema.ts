import { z } from 'zod/v3';
import { regEx } from '../../../util/regex.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release, ReleaseResult } from '../types.ts';

const ProviderAttributes = z.object({
  source: z.string().optional(),
});

const ProviderVersion = z
  .object({
    type: z.literal('provider-versions'),
    attributes: z.object({
      version: z.string(),
      'published-at': MaybeTimestamp,
    }),
  })
  .transform(
    (resource): Release => ({
      version: resource.attributes.version,
      releaseTimestamp: resource.attributes['published-at'],
    }),
  );

export const TerraformProviderV2Response = z
  .object({
    data: z.object({
      attributes: ProviderAttributes,
    }),
    included: LooseArray(ProviderVersion).catch([]),
  })
  .transform(
    (response): ReleaseResult => ({
      sourceUrl: response.data.attributes.source,
      releases: response.included,
    }),
  );

export type TerraformProviderV2Response = z.infer<
  typeof TerraformProviderV2Response
>;

const OpenTofuProviderVersion = z
  .object({
    id: z.string(),
    published: MaybeTimestamp,
  })
  .transform(
    (version): Release => ({
      version: version.id.replace(regEx(/^v/), ''),
      releaseTimestamp: version.published,
    }),
  );

export const OpenTofuProviderDocsResponse = z
  .object({
    versions: LooseArray(OpenTofuProviderVersion).catch([]),
  })
  .transform(
    (response): ReleaseResult => ({
      releases: response.versions,
    }),
  );

export type OpenTofuProviderDocsResponse = z.infer<
  typeof OpenTofuProviderDocsResponse
>;

const TerraformProviderPlatform = z.object({
  os: z.string(),
  arch: z.string(),
});

const TerraformProviderVersionEntry = z.object({
  version: z.string(),
  platforms: LooseArray(TerraformProviderPlatform).catch([]),
});

export const TerraformProviderVersionsResponse = z.object({
  versions: LooseArray(TerraformProviderVersionEntry).catch([]),
});

export type TerraformProviderVersionsResponse = z.infer<
  typeof TerraformProviderVersionsResponse
>;

const OpenTofuProviderPackage = z.object({
  hashes: LooseArray(z.string()).catch([]),
});

export const OpenTofuProviderPackagesResponse = z
  .object({
    packages: z.record(z.string(), OpenTofuProviderPackage).optional(),
  })
  .transform(({ packages }): string[] | null => {
    if (!packages) {
      return null;
    }
    return Object.values(packages).flatMap(({ hashes }) => hashes);
  });

export type OpenTofuProviderPackagesResponse = z.infer<
  typeof OpenTofuProviderPackagesResponse
>;
