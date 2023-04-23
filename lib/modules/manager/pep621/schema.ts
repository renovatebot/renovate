import { z } from 'zod';

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
        })
        .optional(),
    })
    .optional(),
});
