import { z } from 'zod/v3';

export const FvmConfig = z.object({
  flutterSdkVersion: z.string().optional(),
  flutter: z.string().optional(),
});
export type FvmConfig = z.infer<typeof FvmConfig>;
