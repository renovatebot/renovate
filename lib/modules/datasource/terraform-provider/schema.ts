import { z } from 'zod/v3';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import { Release, ReleaseResult } from '../types.ts';

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
