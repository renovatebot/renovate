import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import { Result } from '../../../../util/result';
import { Yaml } from '../../../../util/schema-utils';

export const YarnCatalogsSchema = z
  .object({
    options: z.optional(z.union([z.string(), z.array(z.string())])),
    list: z.record(z.union([z.string(), z.record(z.string())])),
  })
  .optional();

const YarnrcYmlSchema = Yaml.pipe(
  z.object({
    npmRegistryServer: z.string().optional(),
    npmScopes: z
      .record(
        z.object({
          npmRegistryServer: z.string().optional(),
        }),
      )
      .optional(),
    catalogs: YarnCatalogsSchema,
  }),
);

export type YarnConfig = z.infer<typeof YarnrcYmlSchema>;

const registryRegEx = regEx(
  /^"?(@(?<scope>[^:]+):)?registry"? "?(?<registryUrl>[^"]+)"?$/gm,
);

export function loadConfigFromLegacyYarnrc(
  legacyYarnrc: string,
): YarnConfig | null {
  const registryMatches = [...legacyYarnrc.matchAll(registryRegEx)]
    .map((m) => m.groups)
    .filter(is.truthy);

  const yarnConfig: YarnConfig = {};
  for (const registryMatch of registryMatches) {
    if (registryMatch.scope) {
      yarnConfig.npmScopes ??= {};
      yarnConfig.npmScopes[registryMatch.scope] ??= {};
      yarnConfig.npmScopes[registryMatch.scope].npmRegistryServer =
        registryMatch.registryUrl;
    } else {
      yarnConfig.npmRegistryServer = registryMatch.registryUrl;
    }
  }
  return yarnConfig;
}

export function loadConfigFromYarnrcYml(yarnrcYml: string): YarnConfig | null {
  return Result.parse(yarnrcYml, YarnrcYmlSchema)
    .onError((err) => {
      logger.warn({ yarnrcYml, err }, `Failed to load yarnrc file`);
    })
    .unwrapOrNull();
}

export function resolveRegistryUrl(
  packageName: string,
  yarnConfig: YarnConfig,
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
