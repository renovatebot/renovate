import { isArray } from '@sindresorhus/is';
import semver from 'semver';
import { ToolSettingsOptions } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { Lazy } from '../../../../util/lazy.ts';
import type { PackageJson } from '../schema.ts';
import { loadPackageJson } from '../utils.ts';

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
    const packageManagers = isArray(pkg.devEngines.packageManager)
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

export function getNodeOptions(nodeMaxMemory: number): string {
  return '--max-old-space-size=' + nodeMaxMemory;
}
