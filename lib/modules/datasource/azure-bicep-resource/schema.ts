import { z } from 'zod';

export const BicepResourceVersionIndex = z
  .object({
    Resources: z.record(
      z.string(),
      z.object({
        RelativePath: z.string(),
        Index: z.number(),
      }),
    ),
    Functions: z.record(
      z.string(),
      z.record(
        z.string(),
        z.array(
          z.object({
            RelativePath: z.string(),
            Index: z.number(),
          }),
        ),
      ),
    ),
  })
  .transform(({ Resources, Functions }) => {
    const releaseMap = new Map<string, string[]>();

    for (const resourceReference of Object.keys(Resources)) {
      const [type, version] = resourceReference.toLowerCase().split('@', 2);
      const versions = releaseMap.get(type) ?? [];
      versions.push(version);
      releaseMap.set(type, versions);
    }

    for (const [type, versionMap] of Object.entries(Functions)) {
      const versions = Object.keys(versionMap);
      releaseMap.set(type, versions);
    }

    return Object.fromEntries(releaseMap);
  });

export type BicepResourceVersionIndex = z.infer<
  typeof BicepResourceVersionIndex
>;
