import { z } from 'zod';

export const BicepResourceVersionIndex = z
  .object({
    resources: z.record(z.string(), z.unknown()),
    resourceFunctions: z.record(z.string(), z.record(z.string(), z.unknown())),
  })
  .transform(({ resources, resourceFunctions }) => {
    const releaseMap = new Map<string, string[]>();

    for (const resourceReference of Object.keys(resources)) {
      const [type, version] = resourceReference.toLowerCase().split('@', 2);
      const versions = releaseMap.get(type) ?? [];
      versions.push(version);
      releaseMap.set(type, versions);
    }

    for (const [type, versionMap] of Object.entries(resourceFunctions)) {
      const versions = Object.keys(versionMap);
      releaseMap.set(type, versions);
    }

    return Object.fromEntries(releaseMap);
  });

export type BicepResourceVersionIndex = z.infer<
  typeof BicepResourceVersionIndex
>;
