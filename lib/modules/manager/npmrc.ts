import { getManagerConfig } from '../../config/index.ts';
import type { RenovateConfig } from '../../config/types.ts';
import { coerceObject } from '../../util/object.ts';
import { get } from './index.ts';
import { hasUncachedNpmrc, restoreNpmrc, stripNpmrc } from './npm/npmrc.ts';
import type { NpmManagerData } from './npm/types.ts';
import type { NpmrcPackageFile, PackageFile } from './types.ts';

function asNpmrcPackageFiles(
  files: PackageFile[],
): NpmrcPackageFile<NpmManagerData>[] {
  // the managers with `supportsNpmrc` (npm and bun) extract their package files with npm manager data
  return files as NpmrcPackageFile<NpmManagerData>[];
}

/**
 * Returns the package files with those of managers with `supportsNpmrc` replaced by shallow copies without their `npmrc`.
 */
export function withoutNpmrc(
  packageFiles: Record<string, PackageFile[]>,
): Record<string, PackageFile[]> {
  const result = { ...coerceObject(packageFiles) };
  for (const [manager, files] of Object.entries(result)) {
    if (get(manager, 'supportsNpmrc')) {
      result[manager] = stripNpmrc(asNpmrcPackageFiles(files));
    }
  }
  return result;
}

/**
 * Returns the package files with those of managers with `supportsNpmrc` replaced by shallow copies whose `npmrc` is rebuilt from their repository `.npmrc` and the manager config.
 */
export async function withNpmrc(
  packageFiles: Record<string, PackageFile[]>,
  config: RenovateConfig,
): Promise<Record<string, PackageFile[]>> {
  const result = { ...coerceObject(packageFiles) };
  for (const [manager, files] of Object.entries(result)) {
    if (get(manager, 'supportsNpmrc')) {
      result[manager] = await restoreNpmrc(
        asNpmrcPackageFiles(files),
        getManagerConfig(config, manager),
      );
    }
  }
  return result;
}

/**
 * Whether any package file of a manager with `supportsNpmrc` needs its repository `.npmrc` read from disk again.
 */
export function needsNpmrcFromDisk(
  packageFiles: Record<string, PackageFile[]>,
): boolean {
  for (const [manager, files] of Object.entries(coerceObject(packageFiles))) {
    if (
      get(manager, 'supportsNpmrc') &&
      hasUncachedNpmrc(asNpmrcPackageFiles(files))
    ) {
      return true;
    }
  }
  return false;
}
