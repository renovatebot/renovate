import { CustomExtractConfig, PackageFile, Result } from './common';
import { regEx } from '../util/regex';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): Result<PackageFile | null> {
  const regexMatch = regEx(config.matchStrings[0], 'g');
  const deps = [];
  let matchResult;
  let depIndex = 0;
  do {
    matchResult = regexMatch.exec(content);
    if (matchResult) {
      const dep: any = {};
      const { groups } = matchResult;
      dep.depName = config.depNameTemplate || groups.depName;
      dep.lookupName = config.lookupNameTemplate || groups.lookupName;
      dep.currentValue = config.currentValueTemplate || groups.currentValue;
      dep.datasource = config.datasourceTemplate || groups.datasource;
      dep.versioning =
        config.versioningTemplate || groups.versioning || 'semver';
      dep.autoReplaceData = {
        depIndex,
        replaceString: `${matchResult[0]}`,
      };
      deps.push(dep);
    }
    depIndex += 1;
  } while (matchResult);
  if (deps.length) return { deps, matchStrings: config.matchStrings };
  return null;
}
