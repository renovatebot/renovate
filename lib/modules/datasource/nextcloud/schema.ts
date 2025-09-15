import { z } from 'zod';
import { LooseArray, LooseRecord } from '../../../util/schema-utils';

const Translation = z.object({
  changelog: z.string(),
});

export const ApplicationRelease = z.object({
  created: z.string(),
  isNightly: z.boolean(),
  translations: LooseRecord(z.string(), Translation),
  version: z.string(),
});

export const Application = z.object({
  id: z.string(),
  releases: LooseArray(ApplicationRelease),
  website: z.string(),
});

export const Applications = z.array(Application);
