import { z } from 'zod';

export const DevboxRelease = z.object({
  version: z.string(),
  last_updated: z.string(),
});

export const DevboxResponse = z.object({
  name: z.string(),
  summary: z.string(),
  homepage_url: z.string(),
  license: z.string(),
  releases: DevboxRelease.array(),
});
