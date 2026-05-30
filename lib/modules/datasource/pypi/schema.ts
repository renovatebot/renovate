import { z } from 'zod/v4';

export const PypiJSONReleaseSchema = z.object({
  requires_python: z.string().nullish(),
  upload_time: z.string().optional(),
  yanked: z.boolean().optional(),
});

export type PypiJSONReleaseSchema = z.infer<typeof PypiJSONReleaseSchema>;

export const PypiJSONSchema = z
  .object({
    info: z
      .object({
        name: z.string().optional(),
        home_page: z.string().optional(),
        project_urls: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
    releases: z.record(z.string(), z.array(PypiJSONReleaseSchema)).optional(),
  })
  .nullable()
  .catch(null);

export type PypiJSONSchema = z.infer<typeof PypiJSONSchema>;
