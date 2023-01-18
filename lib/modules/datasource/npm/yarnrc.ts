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
  const yarnrc = load(yarnrcYml, {
    json: true,
  }) as YarnConfig;
  if (!is.plainObject<YarnConfig>(yarnrc)) {
    logger.warn({ yarnrcYml }, `Failed to parse yarnrc file`);
    return null;
  }
  return yarnrc;
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
