import { isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { VcpkgDatasource } from '../../datasource/vcpkg/index.ts';
import * as vcpkgVersioning from '../../versioning/vcpkg/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { VcpkgManifest } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const result = VcpkgManifest.safeParse(content);
  if (!result.success) {
    logger.debug(
      { packageFile, err: result.error },
      'Failed to parse vcpkg manifest',
    );
    return null;
  }
  const manifest = result.data;

  const deps: PackageDependency[] = [];

  for (const entry of coerceArray(manifest.dependencies)) {
    if (isString(entry)) {
      deps.push({
        depName: entry,
        depType: 'dependencies',
        datasource: VcpkgDatasource.id,
        versioning: vcpkgVersioning.id,
        skipReason: 'unspecified-version',
      });
      continue;
    }

    const dep: PackageDependency = {
      depName: entry.name,
      depType: 'dependencies',
      datasource: VcpkgDatasource.id,
      versioning: vcpkgVersioning.id,
    };
    const lowerBound = entry['version>='];
    if (lowerBound) {
      dep.currentValue = lowerBound;
    } else {
      dep.skipReason = 'unspecified-version';
    }
    deps.push(dep);
  }

  for (const entry of coerceArray(manifest.overrides)) {
    const upstream =
      entry.version ??
      entry['version-semver'] ??
      entry['version-date'] ??
      entry['version-string'];
    if (!upstream) {
      continue;
    }
    const portVersion = entry['port-version'] ?? 0;
    const currentValue =
      portVersion > 0 ? `${upstream}#${portVersion}` : upstream;
    deps.push({
      depName: entry.name,
      depType: 'overrides',
      currentValue,
      datasource: VcpkgDatasource.id,
      versioning: vcpkgVersioning.id,
    });
  }

  if (deps.length === 0) {
    return null;
  }

  const packageFileContent: PackageFileContent = { deps };
  const packageFileVersion =
    manifest.version ??
    manifest['version-semver'] ??
    manifest['version-date'] ??
    manifest['version-string'];
  if (packageFileVersion) {
    packageFileContent.packageFileVersion = packageFileVersion;
  }
  return packageFileContent;
}
