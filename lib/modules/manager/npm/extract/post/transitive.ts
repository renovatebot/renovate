import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../../logger/index.ts';
import { coerceArray } from '../../../../../util/array.ts';
import { readLocalFile } from '../../../../../util/fs/index.ts';
import { NpmDatasource } from '../../../../datasource/npm/index.ts';
import type { PackageDependency, PackageFile } from '../../../types.ts';
import { packageLockTransitive } from '../../dep-types.ts';
import { type PackageLockEntry, PackageLockPackages } from '../../schema.ts';
import type { NpmManagerData } from '../../types.ts';
import type { LockedPackage } from '../types.ts';

const nodeModules = 'node_modules/';

/**
 * Whether `resolved` is a registry tarball (`<registry>/<name>/-/<name>-<version>.tgz`),
 * rather than a git, file, or other URL which the npm datasource cannot look up.
 */
function isRegistryTarball(
  resolved: string,
  packageName: string,
  version: string,
): boolean {
  const basename = packageName.split('/').pop()!;
  return resolved.endsWith(`/-/${basename}-${version}.tgz`);
}

/**
 * Returns every package `package-lock.json` installs from a registry, once per
 * name and version, leaving out workspace members, links and bundled packages.
 */
export function getLockedPackages(
  packages: Record<string, PackageLockEntry>,
): LockedPackage[] {
  const locked = new Map<string, LockedPackage>();
  for (const [path, entry] of Object.entries(packages)) {
    const idx = path.lastIndexOf(nodeModules);
    // the root project, and workspace members, aren't installed under `node_modules`
    if (idx === -1 || entry.link || entry.inBundle) {
      continue;
    }

    const name = path.slice(idx + nodeModules.length);
    const packageName = entry.name ?? name;
    const version = entry.version;
    if (!version || !semver.valid(version)) {
      continue;
    }

    if (
      entry.resolved &&
      !isRegistryTarball(entry.resolved, packageName, version)
    ) {
      continue;
    }

    locked.set(`${name}@${version}`, { name, packageName, version });
  }

  return [...locked.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) || semver.compare(a.version, b.version),
  );
}

export async function readLockedPackages(
  lockFile: string,
): Promise<LockedPackage[] | null> {
  const content = await readLocalFile(lockFile, 'utf8');
  const parsed = PackageLockPackages.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { lockFile },
      'npm: no `packages` in lock file, so transitive dependencies are not extracted',
    );
    return null;
  }

  return getLockedPackages(parsed.data);
}

/**
 * Adds every package which `package-lock.json` installs, but no package file
 * sharing it declares, as a `lockfile-only` dependency of the package file
 * beside the lock file, so that a vulnerability fix can reach it.
 *
 * A package locked at several versions is added once per version, as an
 * advisory may affect only some of them.
 */
export async function addTransitiveDeps(
  packageFiles: PackageFile<NpmManagerData>[],
): Promise<void> {
  const packageFilesByLock = new Map<string, PackageFile<NpmManagerData>[]>();
  for (const packageFile of packageFiles) {
    const npmLock = packageFile.managerData?.npmLock;
    if (npmLock) {
      const files = coerceArray(packageFilesByLock.get(npmLock));
      files.push(packageFile);
      packageFilesByLock.set(npmLock, files);
    }
  }

  for (const [npmLock, files] of packageFilesByLock) {
    const root = files.find(
      (file) => upath.dirname(file.packageFile) === upath.dirname(npmLock),
    );
    if (!root) {
      continue;
    }

    const locked = await readLockedPackages(npmLock);
    if (!locked) {
      continue;
    }

    // a declared dependency is installed under the name it is declared as
    const declared = new Set(
      files.flatMap((file) => file.deps.map((dep) => dep.depName)),
    );

    const deps: PackageDependency<NpmManagerData>[] = locked
      .filter(({ name }) => !declared.has(name))
      .map(({ name, packageName, version }) => ({
        depName: name,
        packageName,
        datasource: NpmDatasource.id,
        depType: packageLockTransitive,
        prettyDepType: 'transitive',
        lockedVersion: version,
        skipReason: 'lockfile-only',
      }));

    logger.debug(
      { npmLock, count: deps.length },
      'npm: extracted transitive dependencies from lock file',
    );
    root.deps.push(...deps);
  }
}
