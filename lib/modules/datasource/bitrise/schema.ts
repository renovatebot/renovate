import { z } from 'zod/v3';
import { Yaml } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const BitriseStepFile = Yaml.pipe(
  z.object({
    published_at: MaybeTimestamp,
    source_code_url: z.string().optional(),
  }),
);
