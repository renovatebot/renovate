import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

// https://go.dev/ref/mod#goproxy-protocol
export const VersionInfo = z.object({
  Version: z.string(),
  Time: MaybeTimestamp,
  // https://github.com/golang/go/blob/dd612356d8bfe352ec7812ce6c93c9fd2bc10c81/src/cmd/go/internal/modfetch/codehost/codehost.go#L93
  Origin: z
    .object({
      VCS: z.string().optional(),
      URL: z.string().optional(),
    })
    .optional(),
});

export type VersionInfo = z.infer<typeof VersionInfo>;
