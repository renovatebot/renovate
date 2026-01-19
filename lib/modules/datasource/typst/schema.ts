import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import { asTimestamp } from '../../../util/timestamp';
import type { ReleaseResult } from '../types';

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
  const result: Record<string, ReleaseResult> = {};
  for (const item of items) {
    const { packageName, sourceUrl, ...release } = item;
    result[packageName] ??= { releases: [] };
    result[packageName].releases.push(release);
    result[packageName].sourceUrl = sourceUrl;
  }
  return result;
});
