import { z } from 'zod/v4';

// SE-0292 "list package releases" response body.
// https://github.com/swiftlang/swift-evolution/blob/main/proposals/0292-package-registry.md
//
// A release entry can carry a `problem` block to signal that the release
// is unavailable (e.g. retracted). Such entries are skipped by the datasource.
const SwiftRegistryReleaseEntry = z.object({
  url: z.string().optional(),
  problem: z
    .object({
      status: z.number().optional(),
      title: z.string().optional(),
      detail: z.string().optional(),
    })
    .optional(),
});

export const SwiftRegistryReleases = z.object({
  releases: z.record(z.string(), SwiftRegistryReleaseEntry).optional(),
});

export type SwiftRegistryReleases = z.infer<typeof SwiftRegistryReleases>;
