import { isTruthy } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { localPathExists, readLocalFile } from '../../../../util/fs/index.ts';
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

  const mergedConfig: YarnConfig = {
    ...parentConfig,
    ...childConfig,
  };

  for (const [key, parentValue] of Object.entries(parentConfig)) {
    const childValue = childConfig[key as keyof YarnConfig];
    if (
      parentValue &&
      childValue &&
      typeof parentValue === 'object' &&
      typeof childValue === 'object' &&
      !Array.isArray(parentValue) &&
      !Array.isArray(childValue)
    ) {
      mergedConfig[key as keyof YarnConfig] = {
        ...parentValue,
        ...childValue,
      } as never;
    }
  }

  return mergedConfig;
}

async function findLocalSiblingAndParentFiles(
  existingFileNameWithPath: string,
  otherFileName: string,
): Promise<string[]> {
  if (upath.isAbsolute(existingFileNameWithPath)) {
    return [];
  }
  if (upath.isAbsolute(otherFileName)) {
    return [];
  }

  const fileNames: string[] = [];
  let current = existingFileNameWithPath;

  while (current !== '') {
    current = upath.parse(current).dir;
    const candidate = upath.join(current, otherFileName);
    if (await localPathExists(candidate)) {
      fileNames.push(candidate);
    }
  }

  return fileNames;
}

export async function loadConfigFromInheritedYarnrcYml(
  packageFile: string,
): Promise<YarnConfig | null> {
  const yarnrcFileNames = await findLocalSiblingAndParentFiles(
    packageFile,
    '.yarnrc.yml',
  );

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
