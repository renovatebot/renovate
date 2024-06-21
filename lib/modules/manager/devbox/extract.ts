import { logger } from '../../../logger';
import { NixhubDatasource } from '../../datasource/nixhub';
import * as nixhubVersioning from '../../versioning/nixhub';
import type { PackageDependency, PackageFileContent } from '../types';
import { DevboxFile } from './schema';

function isValidDependency(dep: PackageDependency): boolean {
  return !!dep.currentValue && nixhubVersioning.api.isValid(dep.currentValue);
}

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace('devbox.extractPackageFile()');

  const parsedFile = DevboxFile.safeParse(content);
  if (parsedFile.error) {
    logger.debug({ error: parsedFile.error }, 'Error parsing devbox.json');
    return null;
  }

  const file = parsedFile.data;
  const deps: PackageDependency[] = [];

  if (Array.isArray(file.packages)) {
    for (const pkgStr of file.packages) {
      const [pkgName, pkgVer] = pkgStr.split('@');
      const pkgDep = getDep(pkgName, pkgVer);
      if (pkgDep) {
        deps.push(pkgDep);
      }
    }
  } else {
    for (const [pkgName, pkgVer] of Object.entries(file.packages)) {
      const pkgDep = getDep(
        pkgName,
        typeof pkgVer === 'string' ? pkgVer : pkgVer.version,
      );
      if (pkgDep) {
        deps.push(pkgDep);
      }
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}

function getNixhubPackageName(pkgName: string): string {
  // If any package names don't match the Nixhub package name, add them here
  if (pkgName === 'nodejs') {
    return 'node';
  }
  return pkgName;
}

function getDep(pkgName: string, version: string): PackageDependency | null {
  const dep = {
    depName: pkgName,
    currentValue: version,
    datasource: NixhubDatasource.id,
    packageName: getNixhubPackageName(pkgName),
    versioning: nixhubVersioning.id,
  };
  if (!isValidDependency(dep)) {
    logger.trace(
      { pkgName },
      'Skipping invalid devbox dependency in devbox JSON file.',
    );
    return null;
  }
  return dep;
}
