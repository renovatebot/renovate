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

/** The format of the tool files this datasource reads. */
export const formatPath = 'v1';

/**
 * A `<tool>.json` file published by containerbase/tool-versions, reduced to
 * the fields Renovate uses. Files of another format, which `$schema` names, are
 * rejected.
 */
export const ContainerbaseToolVersions = z.object({
  $schema: z.string().endsWith(`/${formatPath}/tool.schema.json`),
  tool: z.string(),
  /** where the source code of the tool lives, when known */
  sourceUrl: z.string().optional(),
  /** the homepage of the tool, when known */
  homepage: z.string().optional(),
  /** newest first */
  versions: LooseArray(ContainerbaseToolVersion),
});

export type ContainerbaseToolVersions = z.infer<
  typeof ContainerbaseToolVersions
>;
