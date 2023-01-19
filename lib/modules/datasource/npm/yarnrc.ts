import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';

export interface YarnConfig {
  npmRegistryServer?: string;
  npmScopes?: Record<
    string,
    {
      npmRegistryServer?: string;
    }
  >;
}

export function loadConfigFromYarnrcYml(yarnrcYml: string): YarnConfig | null {
  let yarnConfig: YarnConfig;
  try {
    yarnConfig = load(yarnrcYml, {
      json: true,
    }) as YarnConfig;
  } catch (err) {
    logger.warn({ yarnrcYml, err }, `Failed to load yarnrc file`);
    return null;
  }
  if (
    !is.plainObject(yarnConfig) ||
    !is.string(yarnConfig.npmRegistryServer) ||
    !is.plainObject(yarnConfig.npmScopes) ||
    Object.values(yarnConfig.npmScopes).some(
      (npmScope) => !is.plainObject(npmScope)
    ) ||
    Object.values(yarnConfig.npmScopes).some(
      (npmScope) =>
        is.plainObject(npmScope) && !is.string(npmScope.npmRegistryServer)
    )
  ) {
    logger.warn({ yarnrcYml }, `Malformed yarnrc file`);
    return null;
  }
  return yarnConfig;
}

export function resolveRegistryUrl(
  packageName: string,
  rules: YarnConfig
): string | null {
  if (rules.npmScopes) {
    for (const scope in rules.npmScopes) {
      if (packageName.startsWith(`@${scope}`)) {
        return rules.npmScopes[scope].npmRegistryServer ?? null;
      }
    }
  }
  if (rules.npmRegistryServer) {
    return rules.npmRegistryServer;
  }
  return null;
}
