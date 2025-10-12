import is from '@sindresorhus/is';
import semver from 'semver';
import { logger } from '../../../../logger';
import { Lazy } from '../../../../util/lazy';
import type { PackageJson } from '../schema';
import { loadPackageJson } from '../utils';

export function lazyLoadPackageJson(
  lockFileDir: string,
): Lazy<Promise<PackageJson>> {
  return new Lazy(() => loadPackageJson(lockFileDir));
}
export type LazyPackageJson = ReturnType<typeof lazyLoadPackageJson>;

export function getPackageManagerVersion(
  name: string,
  pkg: PackageJson,
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
