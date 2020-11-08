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
  matchResult: RegExpMatchArray,
  config: CustomExtractConfig,
  dep?: PackageDependency
): PackageDependency {
  const dependency = dep || {};
  const { groups } = matchResult;
  const fields = [
    'depName',
    'lookupName',
    'currentValue',
    'currentDigest',
    'datasource',
    'versioning',
    'registryUrl',
  ];
  for (const field of fields) {
    const fieldTemplate = `${field}Template`;
    if (config[fieldTemplate]) {
      try {
        dependency[field] = template.compile(config[fieldTemplate], groups);
      } catch (err) {
        logger.warn(
          { template: config[fieldTemplate] },
          'Error compiling template for custom manager'
        );
        return null;
      }
    } else if (groups[field]) {
      dependency[field] = groups[field];
    }
  }
  dependency.replaceString = String(matchResult[0]);
  if (dependency.registryUrl) {
    if (url.parse(dep.registryUrl)) {
      dependency.registryUrls = [dependency.registryUrl];
    }
    delete dependency.registryUrl;
  }
  return dependency;
}

function handleFlat(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  return config.matchStrings
    .map((matchString) => regEx(matchString, 'g'))
    .flatMap((regex) => regexMatchAll(regex, content)) // match all regex to content, get all matches, reduce to single array
    .map((matchResult) => createDependency(matchResult, config));
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): Result<PackageFile | null> {
  let deps = handleFlat(content, packageFile, config);

  deps = deps.filter((dep) => {
    return dep != null;
  });
  if (deps?.length) {
    return { deps, matchStrings: config.matchStrings };
  }
  return null;
}
