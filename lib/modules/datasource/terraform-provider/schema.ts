import { z } from 'zod/v4';
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

// VersionDetailResponse — used by the releases.hashicorp.com backend
export const TerraformBuild = z.object({
  name: z.string(),
  version: z.string(),
  os: z.string(),
  arch: z.string(),
  filename: z.string(),
  url: z.string(),
  shasums_url: z.string().optional(),
});

export type TerraformBuild = z.infer<typeof TerraformBuild>;

export const VersionDetailResponse = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  builds: z.array(TerraformBuild),
});

export type VersionDetailResponse = z.infer<typeof VersionDetailResponse>;

// TerraformProviderReleaseBackend — index.json from releases.hashicorp.com
export const TerraformProviderReleaseBackend = z.object({
  name: z.string().optional(),
  versions: z.record(z.string(), VersionDetailResponse),
});

export type TerraformProviderReleaseBackend = z.infer<
  typeof TerraformProviderReleaseBackend
>;

// TerraformProviderVersions — Provider Registry Protocol /versions endpoint
const TerraformProviderVersionsVersion = z.object({
  version: z.string(),
});

export const TerraformProviderVersions = z.object({
  versions: LooseArray(TerraformProviderVersionsVersion),
});

export type TerraformProviderVersions = z.infer<
  typeof TerraformProviderVersions
>;

// TerraformRegistryVersions — registry /versions endpoint (for getBuilds)
const TerraformRegistryPlatform = z.object({
  os: z.string(),
  arch: z.string(),
});

const TerraformRegistryVersionItem = z.object({
  version: z.string(),
  platforms: LooseArray(TerraformRegistryPlatform),
});

export const TerraformRegistryVersions = z.object({
  versions: LooseArray(TerraformRegistryVersionItem).optional(),
});

export type TerraformRegistryVersions = z.infer<
  typeof TerraformRegistryVersions
>;

// TerraformRegistryBuildResponse — per-platform download info
export const TerraformRegistryBuildResponse = z.object({
  os: z.string(),
  arch: z.string(),
  filename: z.string(),
  download_url: z.string(),
  shasums_url: z.string().optional(),
});

export type TerraformRegistryBuildResponse = z.infer<
  typeof TerraformRegistryBuildResponse
>;
