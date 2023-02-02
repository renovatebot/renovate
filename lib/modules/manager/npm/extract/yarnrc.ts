import { load } from 'js-yaml';
import { z } from 'zod';
import { logger } from '../../../../logger';

const YarnrcYmlSchema = z.object({
  npmRegistryServer: z.string().optional(),
  npmScopes: z
    .record(
      z.object({
        npmRegistryServer: z.string().optional(),
      })
    )
    .optional(),
});

export type YarnConfig = z.infer<typeof YarnrcYmlSchema>;

export function loadConfigFromYarnrcYml(yarnrcYml: string): YarnConfig | null {
  try {
    const obj = load(yarnrcYml, {
      json: true,
    });
    if (!obj) {
      // emtpy yaml file
      return null;
    }
    return YarnrcYmlSchema.parse(obj);
  } catch (err) {
    logger.warn({ yarnrcYml, err }, `Failed to load yarnrc file`);
    return null;
  }
}

export function resolveRegistryUrl(
  packageName: string,
  yarnConfig: YarnConfig
): string | null {
  if (yarnConfig.npmScopes) {
    for (const scope in yarnConfig.npmScopes) {
      if (packageName.startsWith(`@${scope}/`)) {
        return yarnConfig.npmScopes[scope].npmRegistryServer ?? null;
      }
    }
  }
  if (yarnConfig.npmRegistryServer) {
    return yarnConfig.npmRegistryServer;
  }
  return null;
}
