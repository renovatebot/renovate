import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import { NugetDatasource } from '../../../datasource/nuget';
import type { PackageDependency, PackageFileContent } from '../../types';
import type { NugetPackageDependency, Registry } from '../types';
import { applyRegistries } from '../util';

// regex for finding
// #:package Name@Version
// or
// #:sdk Name@Version
const packageRegex = regEx(
  /^#:(?<type>package|sdk)\s+(?<depName>[A-Za-z0-9_.-]+)@(?<currentValue>[0-9][^\s]*)/,
  'gm',
);

export function extractPackagesFromSingleCsharpFile(
  content: string,
  packageFile: string,
  registries: Registry[] | undefined,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  try {
    for (const match of content.matchAll(packageRegex)) {
      const { type, depName, currentValue } = match.groups!;

      const dep: NugetPackageDependency = {
        depName,
        currentValue,
        datasource: NugetDatasource.id,
        depType: type === 'package' ? 'nuget' : 'msbuild-sdk',
      };

      applyRegistries(dep, registries);
      deps.push(dep);
    }
  } catch {
    logger.debug(
      { packageFile },
      `Error trying to find nuget packages and SDKs from single code file.`,
    );
    return null;
  }

  return { deps };
}
