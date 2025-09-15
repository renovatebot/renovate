import is from '@sindresorhus/is';
import { Minimatch } from 'minimatch';
import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { api as semver } from '../../versioning/deno';
import type { PackageDependency, PackageFile } from '../types';
import {
  detectNodeCompatWorkspaces,
  extractDenoCompatiblePackageJson,
} from './compat';
import { DenoLock } from './schema';
import type { DenoManagerData, LockFile } from './types';
import { denoLandRegex, depValueRegex } from './utils';

export async function getDenoLock(filePath: string): Promise<LockFile> {
  const lockfileContent = await readLocalFile(filePath, 'utf8');
  if (!lockfileContent) {
    logger.debug({ filePath }, 'Deno: unable to read lockfile');
    return { lockedVersions: {} };
  }
  const parsedLockfile = DenoLock.safeParse(lockfileContent);
  if (!parsedLockfile.success) {
    logger.debug(
      { filePath, err: parsedLockfile.error },
      'Deno: unable to parse lockfile',
    );
    return { lockedVersions: {} };
  }
  if (parsedLockfile.data.lockfileVersion < 5) {
    logger.warn(
      { filePath },
      `Deno: unsupported lockfile version. Please update ${filePath} on your own.`,
    );
    return { lockedVersions: {} };
  }

  return parsedLockfile.data;
}

export function getLockedVersion(
  deps: PackageDependency<DenoManagerData>,
  lockFileContent: LockFile,
): string | undefined | null {
  if (is.emptyObject(lockFileContent)) {
    return null;
  }
  const { datasource, currentRawValue, currentValue, depName } = deps;

  // deno datasource
  if (datasource === 'deno') {
    // "remote": {
    //   "https://deno.land/std@0.223.0/fs/mod.ts": "c25e6802cbf27f3050f60b26b00c2d8dba1cb7fcdafe34c66006a7473b7b34d4",
    // },
    if (
      lockFileContent.remoteVersions &&
      lockFileContent.remoteVersions.size > 0 &&
      currentRawValue &&
      lockFileContent.remoteVersions.has(currentRawValue)
    ) {
      const match = denoLandRegex.exec(currentRawValue);
      return match?.groups?.currentValue;
    }

    // "redirects": {
    //   "https://deno.land/std": "https://deno.land/std@0.224.0"
    // },
    const key =
      currentValue && depName ? `${depName}@${currentValue}` : depName;
    if (
      lockFileContent.redirectVersions &&
      lockFileContent.redirectVersions.size > 0 &&
      key &&
      lockFileContent.redirectVersions.has(key)
    ) {
      const match = denoLandRegex.exec(
        // SAFETY: checked above
        lockFileContent.redirectVersions.get(key)!,
      );
      return match?.groups?.currentValue;
    }
  }

  // jsr and npm datasource
  if (datasource === 'jsr' || datasource === 'npm') {
    if (
      !lockFileContent.lockedVersions ||
      is.emptyObject(lockFileContent.lockedVersions)
    ) {
      return null;
    }

    // find "jsr:@scope/name@1.2.3" from "jsr:@scope/name@1.2.3"
    if (currentRawValue && lockFileContent.lockedVersions[currentRawValue]) {
      return lockFileContent.lockedVersions[currentRawValue];
    }

    // find "jsr:@scope/name@*" from "jsr:@scope/name"
    if (
      currentRawValue &&
      lockFileContent.lockedVersions[`${currentRawValue}@*`]
    ) {
      return lockFileContent.lockedVersions[`${currentRawValue}@*`];
    }

    for (const [key, value] of Object.entries(lockFileContent.lockedVersions)) {
      const match = depValueRegex.exec(key);
      // find "jsr:@scope/name@1" intersects "jsr:@scope/name@^1.0.0"
      if (
        typeof depName === 'string' &&
        match?.groups?.depName === depName &&
        match?.groups?.datasource === datasource &&
        currentValue &&
        match?.groups?.currentValue &&
        // SAFETY: npm semver define it
        semver.intersects!(match.groups.currentValue, currentValue)
      ) {
        return value;
      }
      continue;
    }
    return null;
  }

  return null;
}

export async function collectPackageJsonAsWorkspaceMember(
  packageFiles: PackageFile<DenoManagerData>[],
): Promise<void> {
  // detect package.json as members of a deno workspace
  const workspaceRoots = packageFiles.filter(
    (pkg) =>
      is.nonEmptyArray(pkg.managerData?.workspaces) &&
      upath.basename(pkg.packageFile).startsWith('deno.json'),
  );
  for (const workspaceRoot of workspaceRoots) {
    const result = await detectNodeCompatWorkspaces(workspaceRoot);
    /* v8 ignore next 3: hard to test */
    if (!result) {
      continue;
    }
    const { packagePaths } = result;
    for (const packagePath of packagePaths) {
      const packageFile = await extractDenoCompatiblePackageJson(packagePath);
      if (packageFile) {
        const pkg = {
          ...packageFile,
          lockFiles: workspaceRoot.lockFiles,
        };
        packageFiles.push(pkg);
      }
    }
  }
}

interface WorkspaceContext {
  lockFiles?: string[];
  rootDir: string;
  packageFile: string;
  matchers: Minimatch[];
}

export function normalizeWorkspace(
  packageFiles: PackageFile<DenoManagerData>[],
): void {
  // determine workspace root to collect lock files of workspace members
  const workspaceContexts: WorkspaceContext[] = [];

  // create reference map for packageFile object
  const packageMap = new Map<string, PackageFile<DenoManagerData>>();
  for (const pkg of packageFiles) {
    packageMap.set(pkg.packageFile, pkg);
  }

  for (const pkg of packageFiles) {
    const workspaces = pkg.managerData?.workspaces;
    if (is.nonEmptyArray(workspaces)) {
      const rootDir = upath.dirname(pkg.packageFile);
      const matchers = workspaces.map(
        (pattern) =>
          // allow ./sub/* to match sub
          new Minimatch(upath.normalize(pattern), {
            dot: true,
            partial: true,
          }),
      );
      workspaceContexts.push({
        lockFiles: pkg.lockFiles,
        rootDir,
        packageFile: pkg.packageFile,
        matchers,
      });
    }
  }

  // remove nested workspace
  // if the workspace is a subdirectory of another workspace, the nested is invalid
  const validContexts: typeof workspaceContexts = [];
  const invalidPackageFiles = new Set<string>();
  for (const [i, currentContext] of workspaceContexts.entries()) {
    let isNested = false;

    for (const [j, otherContext] of workspaceContexts.entries()) {
      if (i === j) {
        continue;
      }

      const found = otherContext.matchers.some((matcher) =>
        matcher.match(currentContext.rootDir),
      );
      if (found) {
        isNested = true;
        invalidPackageFiles.add(currentContext.packageFile);
        break;
      }
    }

    if (!isNested) {
      validContexts.push(currentContext);
    }
  }
  for (const packageFile of invalidPackageFiles) {
    const pkg = packageMap.get(packageFile);
    if (pkg) {
      // remove invalid workspace
      delete pkg.managerData?.workspaces;
    }
  }

  // supply lock files to workspace members from their root
  const workspaceRootFiles = new Set<string>();
  for (const pkg of packageFiles) {
    const workspaces = pkg.managerData?.workspaces;
    if (is.nonEmptyArray(workspaces)) {
      // remove version and name if it is a workspace root
      // https://docs.deno.com/runtime/fundamentals/workspaces/#configuring-built-in-deno-tools
      delete pkg.packageFileVersion;
      delete pkg.managerData?.packageName;
      workspaceRootFiles.add(pkg.packageFile);
    }
  }

  for (const pkg of packageFiles) {
    if (workspaceRootFiles.has(pkg.packageFile)) {
      continue;
    }

    for (const context of workspaceContexts) {
      const { rootDir, matchers, lockFiles } = context;
      const pkgRelativePath = upath.relative(rootDir, pkg.packageFile);
      const pkgDir = upath.dirname(pkgRelativePath);
      const isMatch = matchers.some((matcher) => matcher.match(pkgDir));
      if (isMatch) {
        pkg.lockFiles = lockFiles;
        break;
      }
    }
  }
}

export function filterWorkspaceRootsWithImportMap(
  packageFiles: PackageFile<DenoManagerData>[],
): void {
  // imports and scopes field is ignored when importMap is specified in the root config file
  // https://github.com/denoland/deno/blob/b7061b0f64b3c79b312de5a59122b7184b2fdef2/libs/config/workspace/mod.rs#L154
  // Find a deno workspace root that has importMap
  const workspaceRootsWithImportMap = packageFiles.filter(
    (pkg) =>
      !upath.basename(pkg.packageFile).startsWith('deno.json') &&
      pkg.deps.some((d) => d.depType === 'imports' || d.depType === 'scopes'),
  );
  for (const workspaceRootWithImportMap of workspaceRootsWithImportMap) {
    for (const pkg of packageFiles) {
      if (workspaceRootWithImportMap.packageFile === pkg.packageFile) {
        continue;
      }
      pkg.deps = pkg.deps.filter(
        (dep) => dep.depType !== 'imports' && dep.depType !== 'scopes',
      );
    }
  }
}

async function applyLockedVersion(
  packageFiles: PackageFile<DenoManagerData>[],
): Promise<void> {
  // apply locked versions from lock files
  // use cache to avoid reading the same lock file multiple times
  const lockFileCache = new Map<string, LockFile>();
  for (const pkg of packageFiles) {
    if (is.nonEmptyArray(pkg.lockFiles)) {
      const lockFile = pkg.lockFiles[0];
      let lockFileContent: LockFile;

      if (lockFileCache.has(lockFile)) {
        lockFileContent = lockFileCache.get(lockFile)!;
      } else {
        lockFileContent = await getDenoLock(lockFile);
        lockFileCache.set(lockFile, lockFileContent);
      }

      const withLockedVersionDeps = pkg.deps.map((dep) => {
        const lockedVersion = getLockedVersion(dep, lockFileContent);
        return lockedVersion
          ? {
              ...dep,
              lockedVersion,
            }
          : dep;
      });

      pkg.deps = withLockedVersionDeps;
    }
  }
}

export async function postExtract(
  packageFiles: PackageFile<DenoManagerData>[],
): Promise<void> {
  await collectPackageJsonAsWorkspaceMember(packageFiles);
  normalizeWorkspace(packageFiles);
  filterWorkspaceRootsWithImportMap(packageFiles);
  await applyLockedVersion(packageFiles);
}
