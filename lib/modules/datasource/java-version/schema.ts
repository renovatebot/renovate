import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const AdoptiumJavaVersion = z.object({
  semver: z.string(),
});

export const AdoptiumJavaResponse = z.object({
  versions: LooseArray(AdoptiumJavaVersion).optional(),
});

export type AdoptiumJavaResponse = z.infer<typeof AdoptiumJavaResponse>;
