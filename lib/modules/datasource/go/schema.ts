import { z } from 'zod/v4';

export const VersionInfoSchema = z.object({
  Version: z.string(),
  Time: z.string().optional(),
});

export type VersionInfoSchema = z.infer<typeof VersionInfoSchema>;
