import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';

export const VendirResource = z.object({
  apiVersion: z.literal('vendir.k14s.io/v1alpha1'),
  kind: z.literal('Config'),
});

export const HelmChart = z.object({
  name: z.string(),
  version: z.string(),
  repository: z.object({
    // Because helm charts support multiple protocols https and oci
    // We need to check for the following. Further, because we use the helmv3 manager
    // to handle registryAliases for http or https sources we need to support alias and @
    // as prefixes
    url: z.string().regex(/^(?:oci:|https?:|alias:|@).+/),
  }),
});

export const Contents = z.object({
  path: z.string(),
  helmChart: HelmChart,
});

export const Vendir = VendirResource.extend({
  directories: z.array(
    z.object({
      path: z.string(),
      contents: LooseArray(Contents),
    }),
  ),
});

export type VendirDefinition = z.infer<typeof Vendir>;
export type HelmChartDefinition = z.infer<typeof HelmChart>;
