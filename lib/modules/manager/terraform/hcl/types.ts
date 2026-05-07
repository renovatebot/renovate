import type z from 'zod/v3';
import type { TerraformDefinitionFileJSON } from './schema.ts';

export type TerraformDefinitionFile = z.infer<
  typeof TerraformDefinitionFileJSON
>;
