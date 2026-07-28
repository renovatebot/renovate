import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const VersionInfo = z.object({
  Version: z.string(),
  Time: MaybeTimestamp,
  // https://go.dev/ref/mod#goproxy-protocol
  Origin: z
    .object({
      VCS: z.string().optional(),
      URL: z.string().optional(),
    })
    .optional(),
});

export type VersionInfo = z.infer<typeof VersionInfo>;
