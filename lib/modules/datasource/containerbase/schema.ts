import {
  FormatIndex,
  ToolVersion,
  ToolVersions,
} from '@renovatebot/base-image/zod';
import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/** The format of the tool files this datasource reads. */
export const formatVersion = 1;
export const formatPath = `v${formatVersion}`;

/**
 * The root `index.json` published by containerbase/tool-versions. Formats which
 * don't parse, e.g. with a status added later, are skipped.
 */
export const ContainerbaseFormats = FormatIndex.extend({
  formats: LooseArray(FormatIndex.shape.formats.element),
});

export type ContainerbaseFormats = z.infer<typeof ContainerbaseFormats>;

/**
 * A `<tool>.json` file published by containerbase/tool-versions. Files of
 * another format, which `$schema` names, are rejected, and versions which
 * don't parse are skipped.
 */
export const ContainerbaseToolVersions = ToolVersions.extend({
  $schema: z.string().endsWith(`/${formatPath}/tool.schema.json`),
  /** newest first */
  versions: LooseArray(ToolVersion),
});

export type ContainerbaseToolVersions = z.infer<
  typeof ContainerbaseToolVersions
>;
