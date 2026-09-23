import { z } from 'zod/v4';
import { coerceArray } from '../../../util/array.ts';

export const BicepResourceVersionIndex = z
  .object({
    resources: z.record(z.string(), z.unknown()),
  })
  .transform(({ resources }) => {
    const releaseMap = new Map<string, string[]>();

    for (const resourceReference of Object.keys(resources)) {
      const [type, version] = resourceReference.toLowerCase().split('@', 2);
      const versions = coerceArray(releaseMap.get(type));
      versions.push(version);
      releaseMap.set(type, versions);
    }

    return Object.fromEntries(releaseMap);
  });

export type BicepResourceVersionIndex = z.infer<
  typeof BicepResourceVersionIndex
>;
