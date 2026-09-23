import { z } from 'zod/v4';

export const MergeConfidenceResponse = z.object({
  confidence: z.string(),
});
