import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
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
  packageFile: string,
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
    .filter((dep: PackageDependency) =>
      checkIsValidDependency(dep, packageFile),
    );
}

export function handleCombination(
  content: string,
  packageFile: string,
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

  const replaceMatches = [valueMatch, digestMatch].filter(is.truthy);
  const replaceStart = Math.min(...replaceMatches.map((match) => match.index));
  const replaceEnd = Math.max(
    ...replaceMatches.map((match) => match.index + match[0].length),
  );
  const replaceString = content.substring(replaceStart, replaceEnd);

  return [createDependency({ groups, replaceString }, config)]
    .filter(is.truthy)
    .filter((dep: PackageDependency) =>
      checkIsValidDependency(dep, packageFile),
    );
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
    .filter((dep: PackageDependency) =>
      checkIsValidDependency(dep, packageFile),
    );
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

function checkIsValidDependency(
  dep: PackageDependency,
  packageFile: string,
): boolean {
  const isValid = isValidDependency(dep);
  if (!isValid) {
    const meta = {
      packageDependency: dep,
      packageFile,
    };
    logger.trace(
      meta,
      'Discovered a package dependency by matching regex, but it did not pass validation. Discarding',
    );
    return isValid;
  }

  return isValid;
}
