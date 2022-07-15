import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import type { CustomExtractConfig, PackageDependency } from '../types';
import {
  createDependency,
  isValidDependency,
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
        { groups: matchResult.groups ?? {}, replaceString: matchResult[0] },
        config
      )
    )
    .filter(is.truthy)
    .filter(isValidDependency);
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
      groups: match.groups ?? {},
      replaceString: match?.groups?.currentValue ? match[0] : undefined,
    }))
    .reduce((base, addition) => mergeExtractionTemplate(base, addition));
  return [createDependency(extraction, config)]
    .filter(is.truthy)
    .filter(isValidDependency);
}

export function handleRecursive(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  const regexes = config.matchStrings.map((matchString) =>
    regEx(matchString, 'g')
  );

  function recurse(
    content: string,
    index: number,
    combinedGroups: Record<string, string>
  ): PackageDependency[] {
    // abort if we have no matchString anymore
    if (!regexes[index]) {
      const result = createDependency(
        {
          groups: combinedGroups,
          replaceString: content,
        },
        config
      );
      return result ? [result] : [];
    }
    return regexMatchAll(regexes[index], content).flatMap((match) => {
      return recurse(
        match[0],
        index + 1,
        mergeGroups(combinedGroups, match.groups ?? {})
      );
    });
  }
  return recurse(content, 0, {}).filter(is.truthy).filter(isValidDependency);
}
