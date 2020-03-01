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
      const { groups } = matchResult;
      const depName = groups.depName || config.depName;
      const lookupName = groups.lookupName || config.lookupName;
      const currentValue = groups.currentValue || config.currentValue;
      const datasource = groups.datasource || config.datasource;
      const versioning = groups.versioning || config.versioning || 'semver';
      const dep = {
        depName,
        lookupName,
        currentValue,
        datasource,
        versioning,
        autoReplaceData: {
          depIndex,
          replaceString: matchResult[0],
        },
      };
      deps.push(dep);
    }
    depIndex += 1;
  } while (matchResult);
  if (deps.length) return { deps, matchStrings: config.matchStrings };
  return null;
}
