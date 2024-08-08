import { z } from 'zod';

export const AwsLambdaLayerFilterMetadata = z.object({
  name: z.string(),
  runtime: z.string(),
  architecture: z.string(),
});
