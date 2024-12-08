import { logger } from '../../../logger';
import { DevboxDatasource } from '../../datasource/devbox';
import * as devboxVersioning from '../../versioning/devbox';
import type { PackageDependency, PackageFileContent } from '../types';
import { DevboxFile } from './schema';

function isValidDependency(dep: PackageDependency): boolean {
  return !!dep.currentValue && devboxVersioning.api.isValid(dep.currentValue);
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

function getDep(
  packageName: string,
  version: string,
): PackageDependency | null {
  const dep = {
    depName: packageName,
    currentValue: version,
    datasource: DevboxDatasource.id,
    packageName,
    versioning: devboxVersioning.id,
  };
  if (!isValidDependency(dep)) {
    logger.trace(
      { packageName },
      'Skipping invalid devbox dependency in devbox JSON file.',
    );
    return null;
  }
  return dep;
}
