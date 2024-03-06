import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import type { RecursionParameter, RegexManagerConfig } from './types';
import {
  createDependency,
  isValidDependency,
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

  const { groups, valueMatch, digestMatch } = matches
    .map((match) => ({
      groups: match.groups ?? /* istanbul ignore next: can this happen? */ {},
      valueMatch: match?.groups?.currentValue ? match : undefined,
      digestMatch: match?.groups?.currentDigest ? match : undefined,
    }))
    .reduce((base, addition) => ({
      groups: mergeGroups(base.groups, addition.groups),
      valueMatch: addition.valueMatch ?? base.valueMatch,
      digestMatch: addition.digestMatch ?? base.digestMatch,
    }));

  let replaceString;

  if (valueMatch && digestMatch) {
    const replaceStart = Math.min(valueMatch.index, digestMatch.index);
    const valueEnd = valueMatch.index + valueMatch[0].length;
    const digestEnd = digestMatch.index + digestMatch[0].length;
    const replaceEnd = Math.max(valueEnd, digestEnd);

    replaceString = content.substring(replaceStart, replaceEnd);
  } else {
    replaceString = valueMatch?.[0] ?? digestMatch?.[0];
  }

  return [createDependency({ groups, replaceString }, config)]
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
