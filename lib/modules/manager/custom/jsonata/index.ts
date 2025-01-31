import is from '@sindresorhus/is';
import type { Category } from '../../../../constants';
import { logger } from '../../../../logger';
import { parseJson } from '../../../../util/common';
import { parseYaml } from '../../../../util/yaml';
import type { PackageFileContent } from '../../types';
import type { JsonataExtractConfig } from './types';
import { handleMatching } from './utils';

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
    }
  } catch (err) {
    logger.debug(
      { err, fileName: packageFile, fileFormat: config.fileFormat },
      'Error while parsing file',
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

  return {
    deps,
  };
}
