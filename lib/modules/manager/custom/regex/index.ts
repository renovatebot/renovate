import { isTruthy } from '@sindresorhus/is';
import upath from 'upath';
import type { Category } from '../../../../constants';
import { logger } from '../../../../logger';
import type { MaybePromise } from '../../../../types';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../../types';
import { validMatchFields } from '../utils';
import { handleAny, handleCombination, handleRecursive } from './strategies';
import type {
  PackageFileInfo,
  RegexManagerConfig,
  RegexManagerTemplates,
} from './types';

export const categories: Category[] = ['custom'];

export const defaultConfig = {
  pinDigests: false,
};
export const supportedDatasources = ['*'];
export const displayName = 'Regex';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): MaybePromise<PackageFileContent | null> {
  let deps: PackageDependency[];

  // till this stage, packageFile is the full path
  // so we need to extract filename and dir before passing it for template.compile
  const packageFileName = upath.basename(packageFile);
  const packageFileDir = upath.dirname(packageFile);
  const packageFileInfo: PackageFileInfo = {
    packageFileDir,
    packageFileName,
    content,
    packageFile,
  };

  switch (config.matchStringsStrategy) {
    default:
    case 'any':
      deps = handleAny(config as RegexManagerConfig, packageFileInfo);
      break;
    case 'combination':
      deps = handleCombination(config as RegexManagerConfig, packageFileInfo);
      break;
    case 'recursive':
      deps = handleRecursive(config as RegexManagerConfig, packageFileInfo);
      break;
  }

  // filter all null values
  deps = deps.filter(isTruthy);
  if (deps.length) {
    const res: PackageFileContent & RegexManagerTemplates = {
      deps,
      matchStrings: config.matchStrings,
    };
    if (config.matchStringsStrategy) {
      res.matchStringsStrategy = config.matchStringsStrategy;
    }
    // copy over templates for autoreplace
    for (const field of validMatchFields.map(
      (f) => `${f}Template` as keyof RegexManagerTemplates,
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
  logger.debug(
    { packageFile },
    'No dependencies found in file for custom regex manager',
  );

  return null;
}
