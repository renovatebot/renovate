import { z } from 'zod';

export const PubspecLockSchema = z.object({
  packages: z.record(z.any()),
  sdks: z.object({
    dart: z.string(),
    flutter: z.string().optional(),
  }),
});

export type PubspecLockSchema = z.infer<typeof PubspecLockSchema>;
