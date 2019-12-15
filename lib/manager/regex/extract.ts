import handlebars from 'handlebars';
import * as versioning from '../../versioning';
import { ExtractConfig, PackageFile, PackageDependency } from '../common';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';

export interface RegexManagerConfig extends ExtractConfig {
  extractRegex: string;
  depName: string;
  currentValue: string;
  datasource: string;
  versionScheme: string;
  lookupName?: string;
}

export function extractPackageFile(
  content: string,
  fileName: string,
  config: RegexManagerConfig
): Promise<PackageFile | null> {
  if (
    !(
      config.extractRegex &&
      config.depName &&
      config.currentValue &&
      config.datasource &&
      config.versionScheme
    )
  ) {
    logger.warn({ config }, 'Missing required fields for regex manager');
    return null;
  }
  logger.trace({ content, fileName }, 'Regex manager extract');
  const extractRegex = regEx(config.extractRegex);
  const matches = content.match(extractRegex);
  if (!matches) {
    logger.debug('No matches');
    return null;
  }
  console.warn(matches);
  const deps = [];
  for (const match of matches) {
    const dep: PackageDependency = {
      depName: handlebars.compile(config.depName)(match.groups),
      currentValue: handlebars.compile(config.currentValue)(match.groups),
      datasource: handlebars.compile(config.datasource)(match.groups),
      versionScheme: handlebars.compile(config.versionScheme)(match.groups),
    };
    const versionScheme = versioning.get(config.versionScheme);
    if (!versionScheme.isValid(dep.currentValue)) {
      dep.skipReason = 'unsupported-version';
    }
    deps.push(dep);
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
