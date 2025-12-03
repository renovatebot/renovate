import { isTruthy } from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import { checkIsValidDependency } from '../utils';
import type {
  PackageFileInfo,
  RecursionParameter,
  RegexManagerConfig,
} from './types';
import {
  createDependency,
  mergeExtractionTemplate,
  mergeGroups,
  regexMatchAll,
} from './utils';

export function handleAny(
  config: RegexManagerConfig,
  packageFileInfo: PackageFileInfo,
): PackageDependency[] {
  const { content, packageFile } = packageFileInfo;
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
        packageFileInfo,
      ),
    )
    .filter(isTruthy)
    .filter((dep: PackageDependency) =>
      checkIsValidDependency(dep, packageFile, 'regex'),
    );
}

export function handleCombination(
  config: RegexManagerConfig,
  packageFileInfo: PackageFileInfo,
): PackageDependency[] {
  const { content, packageFile } = packageFileInfo;
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
        (match?.groups?.currentValue ?? match?.groups?.currentDigest)
          ? match[0]
          : undefined,
    }))
    .reduce((base, addition) => mergeExtractionTemplate(base, addition));
  return [createDependency(extraction, config, packageFileInfo)]
    .filter(isTruthy)
    .filter((dep: PackageDependency) =>
      checkIsValidDependency(dep, packageFile, 'regex'),
    );
}

export function handleRecursive(
  config: RegexManagerConfig,
  packageFileInfo: PackageFileInfo,
): PackageDependency[] {
  const { content, packageFile } = packageFileInfo;
  const regexes = config.matchStrings.map((matchString) =>
    regEx(matchString, 'g'),
  );

  return processRecursive({
    content,
    packageFileInfo,
    config,
    index: 0,
    combinedGroups: {},
    regexes,
  })
    .filter(isTruthy)
    .filter((dep: PackageDependency) =>
      checkIsValidDependency(dep, packageFile, 'regex'),
    );
}

function processRecursive(parameters: RecursionParameter): PackageDependency[] {
  const {
    content,
    index,
    combinedGroups,
    regexes,
    config,
    packageFileInfo,
  }: RecursionParameter = parameters;
  // abort if we have no matchString anymore
  if (regexes.length === index) {
    const result = createDependency(
      {
        groups: combinedGroups,
        replaceString: content,
      },
      config,
      packageFileInfo,
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
