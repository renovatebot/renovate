import { z } from 'zod/v3';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

const TerraformProviderV2Attributes = z.object({
  source: z.string().optional(),
});

const TerraformProviderVersionV2 = z
  .object({
    type: z.literal('provider-versions'),
    attributes: z.object({
      version: z.string(),
      'published-at': z.string().optional(),
    }),
  })
  .transform((resource) => ({
    version: resource.attributes.version,
    releaseTimestamp: MaybeTimestamp.parse(resource.attributes['published-at']),
  }));

export const TerraformProviderV2Response = z.object({
  data: z.object({
    attributes: TerraformProviderV2Attributes,
  }),
  included: LooseArray(TerraformProviderVersionV2).catch([]),
});
export type TerraformProviderV2Response = z.infer<
  typeof TerraformProviderV2Response
>;

const OpenTofuProviderVersion = z
  .object({
    id: z.string(),
    published: z.string().optional(),
  })
  .transform((version) => ({
    version: version.id.replace(/^v/, ''),
    releaseTimestamp: MaybeTimestamp.parse(version.published),
  }));

export const OpenTofuProviderDocsResponse = z.object({
  versions: LooseArray(OpenTofuProviderVersion).catch([]),
});
export type OpenTofuProviderDocsResponse = z.infer<
  typeof OpenTofuProviderDocsResponse
>;
