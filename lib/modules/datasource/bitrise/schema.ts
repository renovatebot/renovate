import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';
import { TimestampSchema } from '../../../util/timestamp';

export const BitriseStepFile = Yaml.pipe(
  z.object({
    published_at: TimestampSchema.nullable().catch(null),
    source_code_url: z.string().optional(),
  }),
);
