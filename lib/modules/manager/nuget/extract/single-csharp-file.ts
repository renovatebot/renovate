import { regEx } from '../../../../util/regex.ts';
import { NugetDatasource } from '../../../datasource/nuget/index.ts';
import type { PackageDependency, PackageFileContent } from '../../types.ts';
import type { NugetPackageDependency, Registry } from '../types.ts';
import { applyRegistries } from '../util.ts';

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

  return { deps };
}
