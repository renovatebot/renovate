import { regEx } from '../../util/regex';
import type {
  CustomExtractConfig,
  PackageDependency,
  PackageFile,
  Result,
} from '../types';
import {
  createDependency,
  mergeExtractionTemplate,
  regexMatchAll,
  validMatchFields,
} from './util';

export const defaultConfig = {
  pinDigests: false,
};

function handleAny(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  return config.matchStrings
    .map((matchString) => regEx(matchString, 'g'))
    .flatMap((regex) => regexMatchAll(regex, content)) // match all regex to content, get all matches, reduce to single array
    .map((matchResult) =>
      createDependency(
        { groups: matchResult.groups, replaceString: matchResult[0] },
        config
      )
    );
}

function handleCombination(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  const matches = config.matchStrings
    .map((matchString) => regEx(matchString, 'g'))
    .flatMap((regex) => regexMatchAll(regex, content)); // match all regex to content, get all matches, reduce to single array

  if (!matches.length) {
    return [];
  }

  const extraction = matches
    .map((match) => ({
      groups: match.groups,
      replaceString: match?.groups?.currentValue ? match[0] : undefined,
    }))
    .reduce((base, addition) => mergeExtractionTemplate(base, addition));
  return [createDependency(extraction, config)];
}

function handleRecursive(
  content: string,
  packageFile: string,
  config: CustomExtractConfig,
  index = 0
): PackageDependency[] {
  const regexes = config.matchStrings.map((matchString) =>
    regEx(matchString, 'g')
  );
  // abort if we have no matchString anymore
  if (regexes[index] == null) {
    return [];
  }
  return regexMatchAll(regexes[index], content).flatMap((match) => {
    // if we have a depName and a currentValue with have the minimal viable definition
    if (match?.groups?.depName && match?.groups?.currentValue) {
      return createDependency(
        { groups: match.groups, replaceString: match[0] },
        config
      );
    }
    return handleRecursive(match[0], packageFile, config, index + 1);
  });
}

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
