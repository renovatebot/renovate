import { z } from 'zod';

export const BicepTypeIndex = z.object({
  Resources: z.map(
    z.string(),
    z.object({
      RelativePath: z.string(),
      Index: z.number(),
    })
  ),
  Functions: z.map(
    z.string(),
    z.map(
      z.string(),
      z.array(
        z.object({
          RelativePath: z.string(),
          Index: z.number(),
        })
      )
    )
  ),
});

export type BicepTypeIndex = z.infer<typeof BicepTypeIndex>;
