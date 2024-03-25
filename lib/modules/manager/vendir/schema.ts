import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';

export const VendirResource = z.object({
  apiVersion: z.literal('vendir.k14s.io/v1alpha1'),
  kind: z.literal('Config'),
});

export const GitRef = z.object({
  ref: z.string(),
  url: z.string().regex(/^(?:ssh|https?):\/\/.+/),
  depth: z.number().optional(),
});

export const HelmChart = z.object({
  name: z.string(),
  version: z.string(),
  repository: z.object({
    url: z.string().regex(/^(?:oci|https?):\/\/.+/),
  }),
});

export const HelmChartContent = z.object({
  path: z.string(),
  helmChart: HelmChart,
});

export const GitRefContent = z.object({
  path: z.string(),
  git: GitRef,
});

export const Contents = z.union([HelmChartContent, GitRefContent]);

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
export type GitRefDefinition = z.infer<typeof GitRef>;
