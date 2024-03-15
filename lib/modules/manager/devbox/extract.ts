import { NixhubDatasource } from '../../datasource/nixhub';
import { id as npmVersioning } from '../../versioning/npm';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  // TODO zod, jsonc, and object package syntax
  const file: { packages: string[] } = JSON.parse(content);

  for (const pkgStr of file.packages) {
    const [pkgName, pkgVer] = pkgStr.split('@');
    deps.push({
      depName: pkgName,
      currentValue: pkgVer,
      datasource: NixhubDatasource.id,
      // packageName: pkgName,
      versioning: npmVersioning,
    });
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
