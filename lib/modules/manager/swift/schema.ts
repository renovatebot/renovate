import { z } from 'zod/v4';
import { DeepNullish, Json } from '../../../util/schema-utils/index.ts';

const PackageResolvedPin = DeepNullish(
  z.object({
    identity: z.string(),
    kind: z.string(),
    location: z.string(),
    state: z.object({
      // `revision` is required for source-control pins (kind: "remoteSourceControl"),
      // but absent for SwiftPM Package Registry pins (kind: "registry") per SE-0292:
      // registry packages are identified by version alone, not by a commit SHA. A
      // Package.resolved file mixing both kinds fails validation if we require
      // `revision` unconditionally.
      revision: z.string().optional(),
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
