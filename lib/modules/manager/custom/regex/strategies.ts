import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import type { RecursionParameter, RegexManagerConfig } from './types';
import {
  createDependency,
  isValidDependency,
  mergeExtractionTemplate,
  mergeGroups,
  regexMatchAll,
} from './utils';

export function handleAny(
  content: string,
  _packageFile: string,
  config: RegexManagerConfig,
): PackageDependency[] {
  return config.matchStrings
    .map((matchString) => regEx(matchString, 'g'))
    .flatMap((regex) => regexMatchAll(regex, content)) // match all regex to content, get all matches, reduce to single array
    .map((matchResult) =>
      createDependency(
        {
          groups:
            matchResult.groups ??
            /* istanbul ignore next: can this happen? */ {},
          replaceString: matchResult[0],
        },
        config,
      ),
    )
    .filter(is.truthy)
    .filter(isValidDependency);
}

export function handleCombination(
  content: string,
  _packageFile: string,
  config: RegexManagerConfig,
): PackageDependency[] {
  const matches = config.matchStrings
    .map((matchString) => regEx(matchString, 'g'))
    .flatMap((regex) => regexMatchAll(regex, content)); // match all regex to content, get all matches, reduce to single array

  if (!matches.length) {
    return [];
  }

  const extraction = matches
    .map((match) => ({
      groups: match.groups ?? /* istanbul ignore next: can this happen? */ {},
      replaceString:
        match?.groups?.currentValue ?? match?.groups?.currentDigest
          ? match[0]
          : undefined,
    }))
    .reduce((base, addition) => mergeExtractionTemplate(base, addition));
  return [createDependency(extraction, config)]
    .filter(is.truthy)
    .filter(isValidDependency);
}

export function handleRecursive(
  content: string,
  packageFile: string,
  config: RegexManagerConfig,
): PackageDependency[] {
  const regexes = config.matchStrings.map((matchString) =>
    regEx(matchString, 'g'),
  );

  return processRecursive({
    content,
    packageFile,
    config,
    index: 0,
    combinedGroups: {},
    regexes,
  })
    .filter(is.truthy)
    .filter(isValidDependency);
}

function processRecursive(parameters: RecursionParameter): PackageDependency[] {
  const {
    content,
    index,
    combinedGroups,
    regexes,
    config,
  }: RecursionParameter = parameters;
  // abort if we have no matchString anymore
  if (regexes.length === index) {
    const result = createDependency(
      {
        groups: combinedGroups,
        replaceString: content,
      },
      config,
    );
    return result ? [result] : /* istanbul ignore next: can this happen? */ [];
  }
  return regexMatchAll(regexes[index], content).flatMap((match) => {
    return processRecursive({
      ...parameters,
      content: match[0],
      index: index + 1,
      combinedGroups: mergeGroups(combinedGroups, match.groups ?? {}),
    });
  });
}
