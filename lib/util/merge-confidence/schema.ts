import { z } from 'zod/v4';

export const MergeConfidenceResponseSchema = z.object({
  confidence: z.string(),
});
