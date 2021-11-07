import { URL } from 'url';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import * as template from '../../util/template';
import type {
  CustomExtractConfig,
  PackageDependency,
  PackageFile,
  Result,
} from '../types';
import type { ExtractionTemplate } from './types';

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
  'depType',
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

function createDependency(
  extractionTemplate: ExtractionTemplate,
  config: CustomExtractConfig,
  dep?: PackageDependency
): PackageDependency {
  const dependency = dep || {};
  const { groups, replaceString } = extractionTemplate;

  function updateDependency(field: string, value: string): void {
    switch (field) {
      case 'registryUrl':
        // check if URL is valid and pack inside an array
        try {
          const url = new URL(value).toString();
          dependency.registryUrls = [url];
        } catch (err) {
          logger.warn({ value }, 'Invalid regex manager registryUrl');
        }
        break;
      default:
        dependency[field] = value;
        break;
    }
  }

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template`;
    if (config[fieldTemplate]) {
      try {
        const compiled = template.compile(config[fieldTemplate], groups, false);
        updateDependency(field, compiled);
      } catch (err) {
        logger.warn(
          { template: config[fieldTemplate] },
          'Error compiling template for custom manager'
        );
        return null;
      }
    } else if (groups[field]) {
      updateDependency(field, groups[field]);
    }
  }
  dependency.replaceString = replaceString;
  return dependency;
}

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

function mergeGroups(
  mergedGroup: Record<string, string>,
  secondGroup: Record<string, string>
): Record<string, string> {
  return { ...mergedGroup, ...secondGroup };
}

export function mergeExtractionTemplate(
  base: ExtractionTemplate,
  addition: ExtractionTemplate
): ExtractionTemplate {
  return {
    groups: mergeGroups(base.groups, addition.groups),
    replaceString: addition.replaceString ?? base.replaceString,
  };
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
  index = 0,
  combinedGroups: Record<string, string> = {}
): PackageDependency[] {
  const regexes = config.matchStrings.map((matchString) =>
    regEx(matchString, 'g')
  );
  // abort if we have no matchString anymore
  if (regexes[index] == null) {
    return [];
  }
  return regexMatchAll(regexes[index], content).flatMap((match) => {
    // if we have a depName and a currentValue which have the minimal viable definition
    if (match?.groups?.depName && match?.groups?.currentValue) {
      return createDependency(
        {
          groups: mergeGroups(combinedGroups, match.groups),
          replaceString: match[0],
        },
        config
      );
    }

    return handleRecursive(
      match[0],
      packageFile,
      config,
      index + 1,
      mergeGroups(combinedGroups, match.groups || {})
    );
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
