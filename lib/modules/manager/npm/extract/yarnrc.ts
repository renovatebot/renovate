import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../../logger/index.ts';
import {
  findLocalSiblingAndParents,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { regEx } from '../../../../util/regex.ts';
import { Result } from '../../../../util/result.ts';
import { YarnConfig } from '../schema.ts';

const registryRegEx = regEx(
  /^"?(@(?<scope>[^:]+):)?registry"? "?(?<registryUrl>[^"]+)"?$/gm,
);

export function loadConfigFromLegacyYarnrc(
  legacyYarnrc: string,
): YarnConfig | null {
  const registryMatches = [...legacyYarnrc.matchAll(registryRegEx)]
    .map((m) => m.groups)
    .filter(isTruthy);

  const yarnrcConfig: YarnConfig = {};
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

export function loadConfigFromYarnrcYml(yarnrcYml: string): YarnConfig | null {
  return Result.parse(yarnrcYml, YarnConfig)
    .onError((err) => {
      logger.warn({ yarnrcYml, err }, `Failed to load yarnrc file`);
    })
    .unwrapOrNull();
}

export function mergeYarnConfigs(
  parentConfig: YarnConfig | null,
  childConfig: YarnConfig | null,
): YarnConfig | null {
  if (!parentConfig) {
    return childConfig;
  }
  if (!childConfig) {
    return parentConfig;
  }

  return {
    ...childConfig,
    npmRegistryServer:
      childConfig.npmRegistryServer ?? parentConfig.npmRegistryServer,
    npmScopes: {
      ...parentConfig.npmScopes,
      ...childConfig.npmScopes,
    },
  };
}

export async function loadConfigFromInheritedYarnrcYml(
  packageFile: string,
): Promise<YarnConfig | null> {
  const yarnrcFileNames =
    (await findLocalSiblingAndParents(packageFile, '.yarnrc.yml')) ?? [];

  let yarnrcConfig: YarnConfig | null = null;
  for (const yarnrcFileName of yarnrcFileNames.reverse()) {
    const repoYarnrcYml = await readLocalFile(yarnrcFileName, 'utf8');
    if (repoYarnrcYml?.trim().length) {
      yarnrcConfig = mergeYarnConfigs(
        yarnrcConfig,
        loadConfigFromYarnrcYml(repoYarnrcYml),
      );
    }
  }

  return yarnrcConfig;
}

export function resolveRegistryUrl(
  packageName: string,
  yarnrcConfig: YarnConfig,
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
