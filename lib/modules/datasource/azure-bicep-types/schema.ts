import { z } from 'zod';

export const BicepTypeIndex = z.object({
  Resources: z.record(
    z.string(),
    z.object({
      RelativePath: z.string(),
      Index: z.number(),
    })
  ),
  Functions: z.record(
    z.string(),
    z.record(
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
