import { z } from 'zod';
import { Json5 } from '../../../util/schema-utils';

export const RenovateJson = Json5.pipe(
  z.object({
    extends: z.array(z.string()).optional(),
  }),
);
