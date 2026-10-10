import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const ContainerbaseToolVersion = z.object({
  /** the version, in the format `install-tool` accepts */
  version: z.string(),
  /** only present when `true` */
  prerelease: z.literal(true).optional(),
  /** ISO 8601 release time, when known */
  releaseTimestamp: z.string().optional(),
});

export type ContainerbaseToolVersion = z.infer<typeof ContainerbaseToolVersion>;

/**
 * A `<tool>.json` file published by containerbase/tool-versions, reduced to
 * the fields Renovate uses.
 */
export const ContainerbaseToolVersions = z.object({
  tool: z.string(),
  /** newest first */
  versions: LooseArray(ContainerbaseToolVersion),
});

export type ContainerbaseToolVersions = z.infer<
  typeof ContainerbaseToolVersions
>;
