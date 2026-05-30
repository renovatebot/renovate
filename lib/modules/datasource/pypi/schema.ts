import { z } from 'zod/v4';

export const PypiReleaseSchema = z.object({
  requires_python: z.string().nullish(),
  upload_time: z.string().optional(),
  yanked: z.boolean().optional(),
});

export type PypiJSONRelease = z.infer<typeof PypiReleaseSchema>;

export const PypiResponseSchema = z.object({
  info: z
    .object({
      name: z.string().optional(),
      home_page: z.string().optional(),
      project_urls: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  releases: z.record(z.string(), z.array(PypiReleaseSchema)).optional(),
});

export type PypiResponse = z.infer<typeof PypiResponseSchema>;
