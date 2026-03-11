import { z } from 'zod/v3';
import { Json5 } from '../../../util/schema-utils/index.ts';

export const RenovateJson = Json5.pipe(
  z.object({
    extends: z.array(z.string()).optional(),
  }),
);
