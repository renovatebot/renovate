import is from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { Lazy } from '../../../../util/lazy';
import type { PackageJsonSchema } from '../schema';
import { PackageJson } from '../schema';

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
  if (pkg.volta?.[name]) {
    const version = pkg.volta[name];
    logger.debug(`Found ${name} constraint in package.json volta: ${version}`);

    return version;
  }
  if (pkg.devEngines?.packageManager) {
    const packageManagers = is.array(pkg.devEngines.packageManager)
      ? pkg.devEngines.packageManager
      : [pkg.devEngines.packageManager];
    const packageMgr = packageManagers.find((pm) => pm.name === name);
    const version = packageMgr?.version;
    if (version) {
      logger.debug(
        `Found ${name} constraint in package.json devEngines: ${version}`,
      );
      return version;
    }
  }
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
