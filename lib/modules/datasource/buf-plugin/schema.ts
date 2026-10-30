import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * https://github.com/bufbuild/buf/blob/v1.73.0/proto/buf/alpha/registry/v1alpha1/plugin_curation.proto
 */
const CuratedPluginVersion = z.object({
  version: z.string(),
});

const CuratedPlugin = z.object({
  version: z.string(),
  sourceUrl: z.string().optional(),
  deprecated: z.boolean().optional(),
});

export const GetLatestCuratedPluginResponse = z.object({
  plugin: CuratedPlugin,
  versions: LooseArray(CuratedPluginVersion),
});
