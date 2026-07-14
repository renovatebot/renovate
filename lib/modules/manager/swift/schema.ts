import { z } from 'zod/v4';
import { DeepNullish, Json } from '../../../util/schema-utils/index.ts';

const PackageResolvedPin = DeepNullish(
  z.object({
    identity: z.string(),
    kind: z.string(),
    location: z.string(),
    state: z.object({
      revision: z.string(),
      version: z.string().optional(),
      branch: z.string().optional(),
    }),
  }),
);

export type PackageResolvedPin = z.infer<typeof PackageResolvedPin>;

export const PackageResolvedJson = Json.pipe(
  z.object({
    pins: z.array(PackageResolvedPin),
    version: z.number().int().min(2),
    originHash: z.string().optional(),
  }),
);

export type PackageResolvedJson = z.infer<typeof PackageResolvedJson>;
