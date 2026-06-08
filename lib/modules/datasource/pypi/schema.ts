import { z } from 'zod/v4';
import { Nullish } from '../../../util/schema-utils/index.ts';

export const PypiRelease = z.object({
  requires_python: Nullish(z.string()),
  upload_time: Nullish(z.string()),
  yanked: Nullish(z.boolean()).default(false),
});

export type PypiRelease = z.infer<typeof PypiRelease>;

export const PypiResponse = z.object({
  info: z
    .object({
      name: Nullish(z.string()),
      home_page: Nullish(z.string()),
      project_urls: z.record(z.string(), Nullish(z.string())).optional(),
    })
    .optional(),
  releases: z.record(z.string(), z.array(PypiRelease)).optional(),
});

export type PypiResponse = z.infer<typeof PypiResponse>;
