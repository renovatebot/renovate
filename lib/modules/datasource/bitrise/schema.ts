import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const BitriseStepFile = Yaml.pipe(
  z.object({
    published_at: z.string(),
    source_code_url: z.string().optional(),
  }),
);
