import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const ChartDefinition = z
  .object({
    apiVersion: z.string().regex(/v([12])/),
    name: z.string().min(1),
    version: z.string().min(1),
  })
  .partial();
export type ChartDefinition = z.infer<typeof ChartDefinition>;

export const ChartDefinitionYaml = Yaml.pipe(ChartDefinition);
