import { isArray } from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
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
    // v8 ignore else -- TODO: add test #40625
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
  return `--max-old-space-size=${nodeMaxMemory}`;
}

/**
 * Walk up the directory tree from `lockFileDir` looking for an ancestor
 * `package.json` whose `packageManager` / `devEngines.packageManager` /
 * `engines` / `volta` field pins `name`. Mirrors how corepack itself resolves
 * the binary at runtime, so per-workspace lockfile generation honours a
 * `packageManager` pin set only at the monorepo root.
 *
 * `lockFileDir` itself is intentionally skipped — the caller already loads the
 * sibling `package.json` directly via {@link getPackageManagerVersion}.
 */
export async function getInheritedPackageManagerVersion(
  name: string,
  lockFileDir: string,
): Promise<string | null> {
  const startDir = upath.normalize(lockFileDir || '.');
  let currentDir = upath.dirname(startDir);

  // No ancestor to walk to — lockFileDir is already at the repo root.
  if (currentDir === startDir) {
    return null;
  }

  while (true) {
    const pkg = await loadPackageJson(currentDir);
    const version = getPackageManagerVersion(name, pkg);
    if (version) {
      const relPath =
        currentDir === '.' ? 'package.json' : `${currentDir}/package.json`;
      logger.debug(
        `Found inherited ${name} constraint in ${relPath}: ${version}`,
      );
      return version;
    }

    const parent = upath.dirname(currentDir);
    if (parent === currentDir) {
      // We've already checked the repo root; nowhere left to walk.
      break;
    }
    currentDir = parent;
  }
  return null;
}
