import { z } from 'zod/v3';

const TerraformProviderV2Attributes = z.object({
  source: z.string().optional(),
});

const TerraformProviderVersionV2 = z.object({
  type: z.literal('provider-versions'),
  attributes: z.object({
    version: z.string(),
    'published-at': z.string().optional(),
  }),
});

export const TerraformProviderV2Response = z.object({
  data: z.object({
    attributes: TerraformProviderV2Attributes,
  }),
  included: TerraformProviderVersionV2.array().optional(),
});
export type TerraformProviderV2Response = z.infer<
  typeof TerraformProviderV2Response
>;

const OpenTofuProviderVersion = z.object({
  id: z.string(),
  published: z.string().optional(),
});

export const OpenTofuProviderDocsResponse = z.object({
  versions: OpenTofuProviderVersion.array().optional(),
});
export type OpenTofuProviderDocsResponse = z.infer<
  typeof OpenTofuProviderDocsResponse
>;
