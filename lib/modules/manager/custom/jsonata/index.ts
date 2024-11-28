import type { Category } from '../../../../constants';
import { logger } from '../../../../logger';
import type { PackageFileContent } from '../../types';
import type { JSONataManagerTemplates, JsonataExtractConfig } from './types';
import { handleMatching, validMatchFields } from './utils';

export const categories: Category[] = ['custom'];

export const defaultConfig = {
  pinDigests: false,
};
export const supportedDatasources = ['*'];
export const displayName = 'Jsonata';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: JsonataExtractConfig,
): Promise<PackageFileContent | null> {
  let json;
  try {
    json = JSON.parse(content);
  } catch (err) {
    logger.warn(
      { err, fileName: packageFile },
      `Error parsing '${packageFile}'`,
    );
    return null;
  }

  const deps = await handleMatching(json, packageFile, config);
  if (deps.length) {
    const res: PackageFileContent & JSONataManagerTemplates = {
      deps,
      matchQueries: config.matchQueries,
    };
    // copy over templates for autoreplace
    for (const field of validMatchFields.map(
      (f) => `${f}Template` as keyof JSONataManagerTemplates,
    )) {
      if (config[field]) {
        res[field] = config[field];
      }
    }
    if (config.autoReplaceStringTemplate) {
      res.autoReplaceStringTemplate = config.autoReplaceStringTemplate;
    }
    return res;
  }

  return null;
}
