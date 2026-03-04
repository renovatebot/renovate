import { z } from 'zod/v3';
import { Json } from '../../../util/schema-utils/index.ts';

const PackageResolvedPin = z.object({
  identity: z.string(),
  kind: z.string(),
  location: z.string(),
  state: z.object({
    revision: z.string(),
    version: z.string().nullable(),
    branch: z.string().nullable().optional(),
  }),
});

export type PackageResolvedPin = z.infer<typeof PackageResolvedPin>;

export const PackageResolvedJson = Json.pipe(
  z.object({
    pins: z.array(PackageResolvedPin),
    version: z.number().int().min(2),
    originHash: z.string().optional(),
  }),
);

export type PackageResolvedJson = z.infer<typeof PackageResolvedJson>;
