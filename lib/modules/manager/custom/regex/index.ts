import is from '@sindresorhus/is';
import type { Category } from '../../../../constants';
import type {
  ExtractConfig,
  MaybePromise,
  PackageDependency,
  PackageFileContent,
} from '../../types';
import { validMatchFields } from '../utils';
import { handleAny, handleCombination, handleRecursive } from './strategies';
import type { RegexManagerConfig, RegexManagerTemplates } from './types';

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
  switch (config.matchStringsStrategy) {
    default:
    case 'any':
      deps = handleAny(content, packageFile, config as RegexManagerConfig);
      break;
    case 'combination':
      deps = handleCombination(
        content,
        packageFile,
        config as RegexManagerConfig,
      );
      break;
    case 'recursive':
      deps = handleRecursive(
        content,
        packageFile,
        config as RegexManagerConfig,
      );
      break;
  }

  // filter all null values
  deps = deps.filter(is.truthy);
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

  return null;
}
