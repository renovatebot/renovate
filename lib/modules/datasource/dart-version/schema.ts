import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const DartResponseSchema = z.object({
  kind: z.string().optional(),
  prefixes: LooseArray(z.string()).default([]),
});

export type DartResponse = z.infer<typeof DartResponseSchema>;
