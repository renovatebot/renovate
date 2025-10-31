import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import { asTimestamp } from '../../../util/timestamp';
import type { Release } from '../types';

const ReleaseItem = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    repository: z.string().url(),
    updatedAt: z.number(),
  })
  .transform(
    ({ name: packageName, version, repository: sourceUrl, updatedAt }) => {
      const releaseTimestamp = asTimestamp(updatedAt);
      return { packageName, version, sourceUrl, releaseTimestamp };
    },
  );

export const Registry = LooseArray(ReleaseItem).transform((items) => {
  const result: Record<string, Release[]> = {};
  for (const item of items) {
    const { packageName, ...release } = item;
    result[packageName] ??= [];
    result[packageName].push(release);
  }
  return result;
});
