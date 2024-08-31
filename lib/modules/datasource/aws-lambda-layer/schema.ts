import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const AwsLambdaLayerFilterMetadata = z.object({
  arn: z.string(),
  runtime: z.string().optional(),
  architecture: z.string().optional(),
});

export const FilterParser = Json.pipe(AwsLambdaLayerFilterMetadata);
