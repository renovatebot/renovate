import { isNonEmptyArray } from '@sindresorhus/is';
import { z } from 'zod/v3';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release, ReleaseResult } from '../types.ts';

export const ServiceDiscoveryResponse = z.object({
  'modules.v1': z.string().optional(),
  'providers.v1': z.string().optional(),
});

export type ServiceDiscoveryResponse = z.infer<typeof ServiceDiscoveryResponse>;
export type ServiceDiscoveryEndpointType = keyof ServiceDiscoveryResponse;

export const TerraformModuleResponse = z
  .object({
    source: z.string().optional(),
    versions: z.array(z.string()),
    version: z.string(),
    published_at: MaybeTimestamp,
  })
  .transform((resource) => ({
    source: resource.source,
    versions: resource.versions.map(
      (version): Release => ({
        version,
        ...(version === resource.version && {
          releaseTimestamp: resource.published_at,
        }),
      }),
    ),
  }));

export type TerraformModuleResponse = z.infer<typeof TerraformModuleResponse>;

const ModuleAttributes = z.object({
  source: z.string().optional(),
});

const ModuleVersion = z
  .object({
    type: z.literal('module-versions'),
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

export const TerraformModuleV2Response = z
  .object({
    data: z.object({
      attributes: ModuleAttributes,
    }),
    included: LooseArray(ModuleVersion).catch([]),
  })
  .transform(
    (response): ReleaseResult => ({
      sourceUrl: response.data.attributes.source,
      releases: response.included,
    }),
  );

export type TerraformModuleV2Response = z.infer<
  typeof TerraformModuleV2Response
>;

const OpenTofuModuleVersion = z
  .object({
    id: z.string(),
    published: MaybeTimestamp,
  })
  .transform(
    (version): Release => ({
      version: version.id,
      releaseTimestamp: version.published,
    }),
  );

export const OpenTofuModuleDocsResponse = z
  .object({
    versions: LooseArray(OpenTofuModuleVersion).catch([]),
  })
  .transform(
    (response): ReleaseResult => ({
      releases: response.versions,
    }),
  );

export type OpenTofuModuleDocsResponse = z.infer<
  typeof OpenTofuModuleDocsResponse
>;

export const TerraformModuleVersion = z
  .object({ version: z.string() })
  .transform(({ version }): Release => ({ version }));

export const TerraformModule = z
  .object({
    versions: LooseArray(TerraformModuleVersion),
    source: z.string().optional(),
  })
  .refine(
    ({ versions }) => isNonEmptyArray(versions),
    'Empty versions array in module response',
  );

export const ProtocolModuleResponse = z
  .object({ modules: LooseArray(TerraformModule) })
  .refine(
    ({ modules }) => isNonEmptyArray(modules),
    'Empty response from `/v1/modules` endpoint',
  )
  .transform(({ modules: [module] }) => module);

export type ProtocolModuleResponse = z.infer<typeof ProtocolModuleResponse>;
