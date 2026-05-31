import { z } from 'zod/v4';

export const PypiRelease = z.object({
  requires_python: z.string().nullish(),
  upload_time: z.string().optional(),
  yanked: z.boolean().optional(),
});

export type PypiRelease = z.infer<typeof PypiRelease>;

export const PypiResponse = z.object({
  info: z
    .object({
      name: z.string().optional(),
      home_page: z.string().optional(),
      project_urls: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  releases: z.record(z.string(), z.array(PypiRelease)).optional(),
});

export type PypiResponse = z.infer<typeof PypiResponse>;
