import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import { Result } from '../../../../util/result';
import { Yaml } from '../../../../util/schema-utils';
import { type YarnrcConfig, YarnrcSchema } from '../schema';

const registryRegEx = regEx(
  /^"?(@(?<scope>[^:]+):)?registry"? "?(?<registryUrl>[^"]+)"?$/gm,
);

export function loadConfigFromLegacyYarnrc(
  legacyYarnrc: string,
): YarnrcConfig | null {
  const registryMatches = [...legacyYarnrc.matchAll(registryRegEx)]
    .map((m) => m.groups)
    .filter(is.truthy);

  const yarnrcConfig: YarnrcConfig = {};
  for (const registryMatch of registryMatches) {
    if (registryMatch.scope) {
      yarnrcConfig.npmScopes ??= {};
      yarnrcConfig.npmScopes[registryMatch.scope] ??= {};
      yarnrcConfig.npmScopes[registryMatch.scope].npmRegistryServer =
        registryMatch.registryUrl;
    } else {
      yarnrcConfig.npmRegistryServer = registryMatch.registryUrl;
    }
  }
  return yarnrcConfig;
}

export function loadConfigFromYarnrcYml(
  yarnrcYml: string,
): YarnrcConfig | null {
  return Result.parse(yarnrcYml, Yaml.pipe(YarnrcSchema))
    .onError((err) => {
      logger.warn({ yarnrcYml, err }, `Failed to load yarnrc file`);
    })
    .unwrapOrNull();
}

export function resolveRegistryUrl(
  packageName: string,
  yarnrcConfig: YarnrcConfig,
): string | null {
  if (yarnrcConfig.npmScopes) {
    for (const scope in yarnrcConfig.npmScopes) {
      if (packageName.startsWith(`@${scope}/`)) {
        return yarnrcConfig.npmScopes[scope].npmRegistryServer ?? null;
      }
    }
  }
  if (yarnrcConfig.npmRegistryServer) {
    return yarnrcConfig.npmRegistryServer;
  }
  return null;
}
