import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const VersionInfo = z.object({
  Version: z.string(),
  Time: MaybeTimestamp,
});

export type VersionInfo = z.infer<typeof VersionInfo>;
