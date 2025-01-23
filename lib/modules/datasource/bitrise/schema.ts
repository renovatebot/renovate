import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';
import { MaybeTimestamp } from '../../../util/timestamp';

export const BitriseStepFile = Yaml.pipe(
  z.object({
    published_at: MaybeTimestamp,
    source_code_url: z.string().optional(),
  }),
);
