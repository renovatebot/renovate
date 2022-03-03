import { regEx } from '../../../util/regex';
import type { CustomExtractConfig, PackageDependency } from '../types';
import {
  createDependency,
  mergeExtractionTemplate,
  mergeGroups,
  regexMatchAll,
} from './utils';

export function handleAny(
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

export function handleCombination(
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

export function handleRecursive(
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
  if (!regexes[index]) {
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
