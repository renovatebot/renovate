import { isArray, isInteger, isPlainObject, isString } from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { parseJsonc } from '../../../util/common.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import type { NpmManagerData } from '../npm/types.ts';
import type { NpmrcPackageFile } from '../types.ts';

interface BunLock {
  packages: Record<string, unknown>;
  workspaces: Record<string, unknown>;
}

const directDependencyTypes = new Set([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

const supportedLockfileVersions = new Set([0, 1, 2, 3]);

function parseBunLock(content: string, lockFile: string): BunLock | null {
  try {
    const parsed = parseJsonc(content);
    if (
      !isPlainObject(parsed) ||
      !isInteger(parsed.lockfileVersion) ||
      !supportedLockfileVersions.has(parsed.lockfileVersion) ||
      !isPlainObject(parsed.workspaces) ||
      !isPlainObject(parsed.packages)
    ) {
      return null;
    }

    return {
      packages: parsed.packages,
      workspaces: parsed.workspaces,
    };
  } catch (err) {
    logger.debug({ err, lockFile }, 'Error parsing Bun lockfile.');
    return null;
  }
}

async function getBunLock(
  lockFile: string,
  cache: Map<string, BunLock | null>,
): Promise<BunLock | null> {
  if (cache.has(lockFile)) {
    return cache.get(lockFile) ?? null;
  }

  const content = await readLocalFile(lockFile, 'utf8');
  const lock = content ? parseBunLock(content, lockFile) : null;
  cache.set(lockFile, lock);
  return lock;
}

function getWorkspace(
  lock: BunLock,
  lockFile: string,
  packageFile: NpmrcPackageFile<NpmManagerData>,
): Record<string, unknown> | null {
  const relativeDir = upath.relative(
    upath.dirname(lockFile),
    upath.dirname(packageFile.packageFile),
  );
  const workspace = lock.workspaces[relativeDir];
  return isPlainObject(workspace) ? workspace : null;
}

function getPackageKeys(
  depName: string,
  workspaceName: string | undefined,
  isRoot: boolean,
): string[] {
  if (isRoot || !workspaceName) {
    return [depName];
  }

  return [`${workspaceName}/${depName}`, depName];
}

function isResolvedDirectDependency(
  workspace: Record<string, unknown>,
  depName: string,
  depType: string,
): boolean {
  const dependencies = workspace[depType];
  if (!isPlainObject(dependencies) || !Object.hasOwn(dependencies, depName)) {
    return false;
  }

  const unresolved = workspace.unresolved;
  if (unresolved === undefined) {
    return true;
  }

  return isArray(unresolved, isString) && !unresolved.includes(depName);
}

function getLockedVersion(
  lock: BunLock,
  depName: string,
  depType: string,
  packageName: string,
  workspace: Record<string, unknown>,
  workspaceName: string | undefined,
  isRoot: boolean,
): string | null {
  if (!isResolvedDirectDependency(workspace, depName, depType)) {
    return null;
  }

  const prefix = `${packageName}@`;
  for (const key of getPackageKeys(depName, workspaceName, isRoot)) {
    if (!Object.hasOwn(lock.packages, key)) {
      continue;
    }

    const entry = lock.packages[key];
    if (
      !isArray(entry) ||
      !isString(entry[0]) ||
      !entry[0].startsWith(prefix)
    ) {
      return null;
    }

    return semver.valid(entry[0].slice(prefix.length));
  }

  return null;
}

export async function setBunLockedVersions(
  packageFiles: NpmrcPackageFile<NpmManagerData>[],
): Promise<void> {
  const cache = new Map<string, BunLock | null>();

  for (const packageFile of packageFiles) {
    const lockFile = packageFile.lockFiles?.find(
      (file) => file === 'bun.lock' || file.endsWith('/bun.lock'),
    );
    if (!lockFile) {
      continue;
    }

    const lock = await getBunLock(lockFile, cache);
    if (!lock) {
      continue;
    }

    const relativeDir = upath.relative(
      upath.dirname(lockFile),
      upath.dirname(packageFile.packageFile),
    );
    const workspace = getWorkspace(lock, lockFile, packageFile);
    if (!workspace) {
      continue;
    }
    const workspaceName = isString(workspace.name) ? workspace.name : undefined;
    for (const dep of packageFile.deps) {
      if (
        dep.datasource !== 'npm' ||
        !dep.depName ||
        !dep.depType ||
        !directDependencyTypes.has(dep.depType)
      ) {
        continue;
      }

      const lockedVersion = getLockedVersion(
        lock,
        dep.depName,
        dep.depType,
        dep.packageName ?? dep.depName,
        workspace,
        workspaceName,
        relativeDir === '',
      );
      if (lockedVersion) {
        dep.lockedVersion = lockedVersion;
      }
    }
  }
}
