import type {
  CustomExtractConfig,
  PackageDependency,
  PackageFile,
  Result,
} from '../types';
import { handleAny, handleCombination, handleRecursive } from './strategies';
import { validMatchFields } from './utils';

export const defaultConfig = {
  pinDigests: false,
};

export const supportedDatasources = ['*'];

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): Result<PackageFile | null> {
  let deps: PackageDependency[];
  switch (config.matchStringsStrategy) {
    default:
    case 'any':
      deps = handleAny(content, packageFile, config);
      break;
    case 'combination':
      deps = handleCombination(content, packageFile, config);
      break;
    case 'recursive':
      deps = handleRecursive(content, packageFile, config);
      break;
  }

  // filter all null values
  deps = deps.filter(Boolean);
  if (deps.length) {
    const res: PackageFile = { deps, matchStrings: config.matchStrings };
    if (config.matchStringsStrategy) {
      res.matchStringsStrategy = config.matchStringsStrategy;
    }
    // copy over templates for autoreplace
    for (const field of validMatchFields.map((f) => `${f}Template`)) {
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
