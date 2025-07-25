import is from '@sindresorhus/is';
import type { z } from 'zod';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { regEx } from '../../../../util/regex';
import { Result } from '../../../../util/result';
import { Yaml } from '../../../../util/schema-utils';
import { YarnrcYmlSchema } from '../schema';

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
  return Result.parse(yarnrcYml, Yaml.pipe(YarnrcYmlSchema))
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

export async function loadYarnRcYml(
  yarnrcYmlFileName: string | null,
): Promise<YarnConfig | null> {
  let yarnConfig: YarnConfig | null = null;
  const repoYarnrcYml = yarnrcYmlFileName
    ? await readLocalFile(yarnrcYmlFileName, 'utf8')
    : null;
  if (is.string(repoYarnrcYml) && repoYarnrcYml.trim().length > 0) {
    yarnConfig = loadConfigFromYarnrcYml(repoYarnrcYml);
  }
  return yarnConfig;
}
