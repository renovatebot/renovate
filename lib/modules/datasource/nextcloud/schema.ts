import { z } from 'zod';

const Translation = z.object({
  changelog: z.string(),
});

export const ApplicationRelease = z.object({
  created: z.string(),
  isNightly: z.boolean(),
  translations: z.record(z.string(), Translation),
  version: z.string(),
});

export const Application = z.object({
  id: z.string(),
  releases: z.array(ApplicationRelease),
  website: z.string(),
});

export const Applications = z.array(Application);
