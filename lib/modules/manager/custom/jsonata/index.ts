import { isNullOrUndefined } from '@sindresorhus/is';
import type { Category } from '../../../../constants/index.ts';
import { logger } from '../../../../logger/index.ts';
import { parseJson } from '../../../../util/common.ts';
import { parse as parseToml } from '../../../../util/toml.ts';
import { parseYaml } from '../../../../util/yaml.ts';
import type { PackageFileContent } from '../../types.ts';
import { validMatchFields } from '../utils.ts';
import type { JSONataManagerTemplates, JsonataExtractConfig } from './types.ts';
import { handleMatching } from './utils.ts';

export const categories: Category[] = ['custom'];

export const defaultConfig = {
  pinDigests: false,
};
export const supportedDatasources = ['*'];
export const displayName = 'JSONata';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: JsonataExtractConfig,
): Promise<PackageFileContent | null> {
  let json: unknown;
  try {
    switch (config.fileFormat) {
      case 'json':
        json = parseJson(content, packageFile);
        break;
      case 'yaml':
        json = parseYaml(content);
        break;
      case 'toml':
        json = parseToml(content);
        break;
    }
  } catch (err) {
    logger.debug(
      { err, fileName: packageFile, fileFormat: config.fileFormat },
      'Error while parsing file',
    );
    return null;
  }

  if (isNullOrUndefined(json)) {
    return null;
  }

  const deps = await handleMatching(json, packageFile, config);
  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent & JSONataManagerTemplates = {
    deps,
    matchStrings: config.matchStrings,
    fileFormat: config.fileFormat,
  };

  // copy over templates for autoreplace
  for (const field of validMatchFields.map(
    (f) => `${f}Template` as keyof JSONataManagerTemplates,
  )) {
    if (config[field]) {
      res[field] = config[field];
    }
  }

  return res;
}
