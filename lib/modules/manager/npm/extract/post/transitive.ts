// PROTOTYPE: surface package-lock.json transitive deps for security updates
import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../../logger/index.ts';
import { coerceArray } from '../../../../../util/array.ts';
import { readLocalFile } from '../../../../../util/fs/index.ts';
import type { PackageDependency, PackageFile } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';

interface LockEntry {
  version?: string;
  link?: boolean;
  resolved?: string;
}

export async function addTransitiveDeps(
  packageFiles: PackageFile<NpmManagerData>[],
): Promise<void> {
  const byLock = new Map<string, PackageFile<NpmManagerData>[]>();
  for (const pf of packageFiles) {
    const npmLock = pf.managerData?.npmLock;
    if (npmLock) {
      byLock.set(npmLock, [...coerceArray(byLock.get(npmLock)), pf]);
    }
  }

  for (const [npmLock, files] of byLock) {
    const root = files.find(
      (pf) => upath.dirname(pf.packageFile) === upath.dirname(npmLock),
    );
    if (!root) {
      continue;
    }
    const content = await readLocalFile(npmLock, 'utf8');
    let packages: Record<string, LockEntry> | undefined;
    try {
      packages = JSON.parse(content!).packages;
    } catch {
      continue;
    }
    if (!packages) {
      // lockfileVersion 1 has no `packages`
      continue;
    }

    const declared = new Set<string>();
    for (const pf of files) {
      for (const dep of pf.deps) {
        if (dep.packageName ?? dep.depName) {
          declared.add((dep.packageName ?? dep.depName)!);
        }
      }
    }

    const versions = new Map<string, Set<string>>();
    for (const [key, entry] of Object.entries(packages)) {
      const idx = key.lastIndexOf('node_modules/');
      if (idx === -1 || entry.link || !entry.version) {
        continue;
      }
      // skip non-registry sources (git, file, tarball URLs)
      if (entry.resolved && !entry.resolved.startsWith('http')) {
        continue;
      }
      if (!semver.valid(entry.version)) {
        continue;
      }
      const name = key.slice(idx + 'node_modules/'.length);
      if (declared.has(name)) {
        continue;
      }
      versions.set(name, (versions.get(name) ?? new Set()).add(entry.version));
    }

    const deps: PackageDependency<NpmManagerData>[] = [];
    for (const [name, vs] of versions) {
      const sorted = [...vs].sort(semver.compare);
      deps.push({
        depName: name,
        packageName: name,
        datasource: 'npm',
        depType: 'transitive',
        lockedVersion: sorted[0],
        skipReason: 'lockfile-only',
        managerData: {
          ...root.managerData,
          lockedInstances: sorted,
        } as NpmManagerData,
      });
    }
    logger.debug(
      { npmLock, count: deps.length },
      'PROTOTYPE: surfaced npm transitive deps',
    );
    root.deps.push(...deps);
  }
}
