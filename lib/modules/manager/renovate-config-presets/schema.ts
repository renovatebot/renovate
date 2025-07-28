import { z } from 'zod';
import { Json5 } from '../../../util/schema-utils';

export const RenovateJsonSchema = Json5.pipe(
  z.object({
    extends: z.array(z.string()).optional(),
  }),
);
