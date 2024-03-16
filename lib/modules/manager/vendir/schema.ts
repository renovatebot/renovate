import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';

export const KubernetesResource = z.object({
  apiVersion: z.literal('vendir.k14s.io/v1alpha1'),
});

export const HelmChart = z.object({
  name: z.string(),
  version: z.string(),
  repository: z.object({ url: z.string() }),
});

export const Contents = z.object({
  path: z.string(),
  helmChart: LooseArray(HelmChart),
});

export const Vendir = KubernetesResource.extend({
  kind: z.literal('Config'),
  directories: LooseArray(
    z.object({
      path: z.string(),
      contents: LooseArray(Contents),
    }),
  ),
});

export type VendirDefinition = z.infer<typeof Vendir>;
export type HelmChartDefinition = z.infer<typeof HelmChart>;
