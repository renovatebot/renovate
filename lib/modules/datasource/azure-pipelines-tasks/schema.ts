import { z } from 'zod';

export const AzurePipelinesTaskVersion = z.object({
  major: z.number(),
  minor: z.number(),
  patch: z.number(),
});

export const AzurePipelinesTask = z.object({
  name: z.string(),
  deprecated: z.boolean().optional(),
  version: AzurePipelinesTaskVersion.nullable(),
});

export const AzurePipelinesJSON = z.object({
  value: AzurePipelinesTask.array(),
});

export const AzurePipelinesFallbackTasks = z.record(z.string().array());
