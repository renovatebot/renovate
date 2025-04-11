import { z } from 'zod';

export const AzurePipelinesTaskVersion = z.object({
  major: z.number(),
  minor: z.number(),
  patch: z.number(),
});

export const AzurePipelinesTask = z.object({
  id: z.string(),
  name: z.string(),
  deprecated: z.boolean().optional(),
  serverOwned: z.boolean().optional(),
  version: AzurePipelinesTaskVersion.nullable(),
  contributionIdentifier: z.string().optional(),
});

export const AzurePipelinesJSON = z.object({
  value: AzurePipelinesTask.array(),
});

export const AzurePipelinesFallbackTasks = z.record(z.string().array());
