import { isNonEmptyArray } from '@sindresorhus/is';
import { z } from 'zod/v3';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

export const ServiceDiscoveryResponse = z.object({
  'modules.v1': z.string().optional(),
  'providers.v1': z.string().optional(),
});

export type ServiceDiscoveryResult = z.infer<typeof ServiceDiscoveryResponse>;
export type ServiceDiscoveryEndpointType = keyof ServiceDiscoveryResult;

export const TerraformModuleResponse = z
  .object({
    source: z.string().optional(),
    versions: z.array(z.string()),
    version: z.string(),
    published_at: z.string(),
  })
  .transform((resource) => ({
    source: resource.source,
    versions: resource.versions.map(
      (version): Release => ({
        version,
        releaseTimestamp:
          version === resource.version
            ? MaybeTimestamp.parse(resource.published_at)
            : undefined,
      }),
    ),
  }));

export type TerraformRelease = z.infer<typeof TerraformModuleResponse>;

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

export const TerraformModuleVersionsResponse = z
  .object({ modules: LooseArray(TerraformModule) })
  .refine(
    ({ modules }) => isNonEmptyArray(modules),
    'Empty response from `/v1/modules` endpoint',
  )
  .transform(({ modules: [module] }) => module);

export type TerraformModuleVersions = z.infer<
  typeof TerraformModuleVersionsResponse
>;
