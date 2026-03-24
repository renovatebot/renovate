import { z } from 'zod/v3';
import type { Release } from '../types.ts';

export const Homepage = z.string().optional().catch(undefined);

export const Repository = z
  .object({
    type: z.literal('git'),
    url: z.string(),
  })
  .transform(({ url }) => url)
  .optional()
  .catch(undefined);

export const Versions = z
  .string()
  .transform((version): Release => ({ version }))
  .array();

export const Sri = z.record(z.string());

export const CdnjsAPIVersionResponse = z.object({
  homepage: Homepage,
  repository: Repository,
  versions: Versions,
});

export const CdnjsAPISriResponse = z.object({
  sri: Sri,
});
