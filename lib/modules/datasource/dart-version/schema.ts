import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const DartResponseSchema = z.object({
  kind: z.string().optional().nullable(),
  prefixes: LooseArray(z.string()).catch([]),
});

export type DartResponse = z.infer<typeof DartResponseSchema>;
