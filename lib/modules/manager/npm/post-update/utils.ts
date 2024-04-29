import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { Lazy } from '../../../../util/lazy';
import { PackageJson, PackageJsonSchema } from '../schema';

export function lazyLoadPackageJson(
  lockFileDir: string,
): Lazy<Promise<PackageJsonSchema>> {
  return new Lazy(() => loadPackageJson(lockFileDir));
}

export type LazyPackageJson = ReturnType<typeof lazyLoadPackageJson>;

export async function loadPackageJson(
  lockFileDir: string,
): Promise<PackageJsonSchema> {
  const json = await readLocalFile(
    upath.join(lockFileDir, 'package.json'),
    'utf8',
  );
  const res = PackageJson.safeParse(json);
  if (res.success) {
    return res.data;
  }
  return {};
}

export function getPackageManagerVersion(
  name: string,
  pkg: PackageJsonSchema,
): string | null {
  if (pkg.packageManager?.name === name) {
    const version = pkg.packageManager.version;
    logger.debug(
      `Found ${name} constraint in package.json packageManager: ${version}`,
    );
    if (semver.valid(version)) {
      return version;
    }
    return null;
  }
  if (pkg.engines?.[name]) {
    const version = pkg.engines[name];
    logger.debug(
      `Found ${name} constraint in package.json engines: ${version}`,
    );
    return version;
  }
  return null;
}
