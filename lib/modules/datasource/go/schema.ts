import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const VersionInfoSchema = z.object({
  Version: z.string(),
  Time: MaybeTimestamp,
});

export type VersionInfoSchema = z.infer<typeof VersionInfoSchema>;
