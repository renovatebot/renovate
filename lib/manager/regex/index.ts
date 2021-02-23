import url from 'url';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import * as template from '../../util/template';
import {
  CustomExtractConfig,
  PackageDependency,
  PackageFile,
  Result,
} from '../common';

export const defaultConfig = {
  pinDigests: false,
};

const validMatchFields = [
  'depName',
  'lookupName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
];

function regexMatchAll(regex: RegExp, content: string): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = [];
  let matchResult;
  do {
    matchResult = regex.exec(content);
    if (matchResult) {
      matches.push(matchResult);
    }
  } while (matchResult);
  return matches;
}

function setField(dep: PackageDependency, field: string, value: any): void {
  if (field === 'registryUrl') {
    if (url.parse(value)) {
      // eslint-disable-next-line no-param-reassign
      dep.registryUrls = [value];
    }
  } else {
    // eslint-disable-next-line no-param-reassign
    dep[field] = value;
  }
}

function createDependency(
  matchResult: RegExpMatchArray,
  config: CustomExtractConfig,
  dep?: PackageDependency
): PackageDependency {
  const dependency = dep || {};
  const { groups } = matchResult;
  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template`;
    if (config[fieldTemplate]) {
      try {
        const value = template.compile(config[fieldTemplate], groups, false);
        setField(dependency, field, value);
      } catch (err) {
        logger.warn(
          { template: config[fieldTemplate] },
          'Error compiling template for custom manager'
        );
        return null;
      }
    } else if (groups[field]) {
      setField(dependency, field, groups[field]);
    }
  }
  dependency.replaceString = String(matchResult[0]);
  return dependency;
}

function mergeDependency(deps: PackageDependency[]): PackageDependency {
  const result: PackageDependency = {};
  deps.forEach((dep) => {
    validMatchFields.forEach((field) => {
      if (dep[field]) {
        result[field] = dep[field];
        // save the line replaceString of the section which contains the current Value for a speed up lookup during the replace phase
        if (field === 'currentValue') {
          result.replaceString = dep.replaceString;
        }
      }
    });
  });
  return result;
}

function handleAny(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  return config.matchStrings
    .map((matchString) => regEx(matchString, 'g'))
    .flatMap((regex) => regexMatchAll(regex, content)) // match all regex to content, get all matches, reduce to single array
    .map((matchResult) => createDependency(matchResult, config));
}

function handleCombination(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  const dep = handleAny(content, packageFile, config).reduce(
    (mergedDep, currentDep) => mergeDependency([mergedDep, currentDep]),
    {}
  ); // merge fields of dependencies
  return [dep];
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
      return createDependency(match, config);
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
    return res;
  }

  return null;
}
