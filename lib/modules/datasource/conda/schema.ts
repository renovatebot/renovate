import { z } from 'zod/v4';
import { DeepNullish, LooseArray } from '../../../util/schema-utils/index.ts';

export const CondaFile = DeepNullish(
  z.object({
    version: z.string(),
    upload_time: z.string().optional(),
  }),
);

export const CondaPackage = DeepNullish(
  z.object({
    html_url: z.string().optional(),
    dev_url: z.string().optional(),
    files: LooseArray(CondaFile).optional(),
    versions: z.array(z.string()).optional(),
  }),
);

export type CondaPackage = z.infer<typeof CondaPackage>;

/**
 * One build record from a channel index, i.e. one entry of the `packages` or
 * `packages.conda` section.
 */
export const RepodataPackage = z.object({
  name: z.string(),
  version: z.string(),
  /**
   * Normalized with `asTimestamp` when the build is merged rather than declared
   * as `MaybeTimestamp` here: a build whose `timestamp` is malformed (`null` and
   * stringified numbers are both seen in the wild) must keep its version, and a
   * field schema that rejected it would drop the whole build - and with it
   * possibly the only record of that version.
   */
  timestamp: z.unknown().optional(),
});

export type RepodataPackage = z.infer<typeof RepodataPackage>;
