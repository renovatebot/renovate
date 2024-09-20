import { z } from 'zod';

export const BitriseStepFile = z.object({
  published_at: z.string(),
  source_code_url: z.string().optional(),
});
