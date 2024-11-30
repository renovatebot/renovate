import is from '@sindresorhus/is';
import type { Category } from '../../../../constants';
import { logger } from '../../../../logger';
import { parseJson } from '../../../../util/common';
import type { PackageFileContent } from '../../types';
import type { JSONataManagerTemplates, JsonataExtractConfig } from './types';
import { handleMatching, validMatchFields } from './utils';

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
  let json;
  try {
    json = parseJson(content, packageFile);
  } catch (err) {
    logger.warn(
      { err, fileName: packageFile },
      'File is not a valid JSON file.',
    );
    return null;
  }

  if (is.nullOrUndefined(json)) {
    return null;
  }

  const deps = await handleMatching(json, packageFile, config);
  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent & JSONataManagerTemplates = {
    deps,
    matchStrings: config.matchStrings,
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
