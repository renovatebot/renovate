import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../types';
import { depNameToDatasource } from './datasources';

const dependsOnRegex = regEx(
  /(?<replaceString>(?<depName>[^=\s]+)\s*=\s*(?<version>[^=\s]+))/g,
);

export function extractPackageFile(
  fileContent: string,
): PackageFileContent | null {
  const matches = [...fileContent.matchAll(dependsOnRegex)]
    .map((m) => m.groups)
    .filter(is.truthy);
  const deps: PackageDependency[] = [];
  for (const match of matches) {
    const datasource = depNameToDatasource(match.depName);
    if (datasource === null) {
      continue;
    }
    const dep: PackageDependency = {
      currentValue: match.version,
      depName: match.depName,
      replaceString: match.replaceString,
      datasource,
    };
    deps.push(dep);
  }

  if (deps.length === 0) {
    return null;
  }

  return {
    deps,
  };
}
