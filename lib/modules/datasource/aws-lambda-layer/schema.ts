import { z } from 'zod';

export const AwsLambdaLayerFilterMetadata = z.object({
  arn: z.string(),
  runtime: z.string(),
  architecture: z.string(),
});
