import { z } from 'zod';

export type PyProject = z.infer<typeof PyProjectSchema>;

export const PyProjectSchema = z.object({
  project: z
    .object({
      dependencies: z.array(z.string()).optional(),
      'optional-dependencies': z
        .record(z.string(), z.array(z.string()))
        .optional(),
    })
    .optional(),
  tool: z
    .object({
      pdm: z
        .object({
          'dev-dependencies': z
            .record(z.string(), z.array(z.string()))
            .optional(),
          source: z
            .array(
              z.object({
                url: z.string(),
                name: z.string(),
                verify_ssl: z.boolean().optional(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
