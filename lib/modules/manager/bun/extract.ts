import {
  isArray,
  isNullOrUndefined,
  isObject,
  isString,
} from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { parseJsonc } from '../../../util/common.ts';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs/index.ts';

import { extractDependency } from '../npm/extract/common/dependency.ts';
import { extractPackageJson } from '../npm/extract/common/package-file.ts';
import type { NpmPackage } from '../npm/extract/types.ts';
import { resolveNpmrc } from '../npm/npmrc.ts';
import type { NpmManagerData } from '../npm/types.ts';
import type {
  ExtractConfig,
  NpmrcPackageFile,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { filesMatchingWorkspaces } from './utils.ts';

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

const lockfileDependencyTypes = new Set<string | undefined>([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'overrides',
]);

const BunLock = z.object({
  lockfileVersion: z.union([z.literal(1), z.literal(2)]),
  workspaces: z.record(
    z.string(),
    z.object({
      name: z.string().optional(),
      optionalPeers: z.array(z.string()).optional(),
    }),
  ),
  overrides: z.record(z.string(), z.string()).optional(),
  packages: z.record(z.string(), z.tuple([z.string()]).rest(z.unknown())),
});

/** Re-extract a manifest using versions from the regenerated text lockfile. */
export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig = {},
): Promise<PackageFileContent<NpmManagerData> | null> {
  let result: PackageFileContent<NpmManagerData> | null;
  try {
    result = extractPackageJson(JSON.parse(content), packageFile);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing package.json');
    return null;
  }
  if (!result) {
    return null;
  }

  const lockFile = config.lockFiles?.find((file) =>
    matchesFileName(file, 'bun.lock'),
  );
  // Binary lockfiles cannot be parsed as text. Do not fall back to manifest ranges.
  if (!lockFile) {
    return null;
  }
  let lockContent = config.fileContents?.[lockFile];
  if (lockContent === undefined) {
    lockContent = await readLocalFile(lockFile, 'utf8');
  }
  if (isNullOrUndefined(lockContent)) {
    return null;
  }

  let lock: z.infer<typeof BunLock>;
  try {
    lock = BunLock.parse(parseJsonc(lockContent.toString()));
  } catch (err) {
    logger.debug({ err, lockFile }, 'Error parsing bun.lock');
    return null;
  }

  const workspacePath = upath.relative(
    upath.dirname(lockFile),
    upath.dirname(packageFile),
  );
  const workspace = lock.workspaces[workspacePath];
  const unnamedWorkspace = workspacePath && !workspace?.name;
  if (!workspace || unnamedWorkspace) {
    return null;
  }

  const deps: PackageDependency<NpmManagerData>[] = [];
  for (const dep of result.deps) {
    const isLockfileDependency = lockfileDependencyTypes.has(dep.depType);
    if (!isLockfileDependency || dep.datasource !== 'npm' || dep.skipReason) {
      deps.push(dep);
      continue;
    }
    const depName = dep.depName!;
    const workspaceKey = `${workspace.name}/${depName}`;
    const workspaceEntry = workspacePath
      ? lock.packages[workspaceKey]
      : undefined;
    const entry = workspaceEntry ?? lock.packages[depName];
    if (!entry) {
      const isOptionalPeer =
        dep.depType === 'peerDependencies' &&
        workspace.optionalPeers?.includes(depName);
      if (isOptionalPeer) {
        continue;
      }
      // Overrides of transitive dependencies need not have a root lock entry.
      if (dep.depType === 'overrides') {
        deps.push(dep);
        continue;
      }
      return null;
    }
    const separator = entry[0].indexOf('@', 1);
    if (separator === -1) {
      return null;
    }
    const resolvedName = entry[0].slice(0, separator);
    const reference = entry[0].slice(separator + 1);
    if (reference.startsWith('workspace:')) {
      const target = lock.workspaces[reference.slice('workspace:'.length)];
      if (target?.name === resolvedName) {
        continue;
      }
      return null;
    }
    const packageName = dep.packageName ?? depName;
    if (resolvedName !== packageName) {
      const override = lock.overrides?.[depName];
      const replacement = extractDependency('overrides', depName, override);
      if (replacement.packageName === resolvedName) {
        // The override record, rather than the shadowed declaration, owns this identity.
        continue;
      }
      return null;
    }
    const version = semver.valid(reference);
    if (!version) {
      return null;
    }
    dep.lockedVersion = version;
    deps.push(dep);
  }
  return { ...result, deps };
}

export async function processPackageFile(
  packageFile: string,
  config: ExtractConfig,
): Promise<NpmrcPackageFile<NpmManagerData> | null> {
  const fileContent = await readLocalFile(packageFile, 'utf8');
  if (!fileContent) {
    logger.warn({ fileName: packageFile }, 'Could not read file content');
    return null;
  }
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(fileContent);
  } catch (err) {
    logger.debug({ err }, 'Error parsing package.json');
    return null;
  }
  const result = extractPackageJson(packageJson, packageFile);
  if (!result) {
    logger.debug({ packageFile }, 'No dependencies found');
    return null;
  }

  const { npmrc, npmrcFileName, repoNpmrc } = await resolveNpmrc(
    packageFile,
    config,
  );

  return {
    ...result,
    packageFile,
    ...(isString(npmrc) && { npmrc }),
    managerData: {
      ...result.managerData,
      // store npmrc file name so that a repository `.npmrc` which is not cached is read from disk again
      npmrcFileName,
      // stored instead of `npmrc` in the repository cache, from which `npmrc` is rebuilt
      ...(repoNpmrc && { repoNpmrc }),
    },
  };
}
export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<NpmrcPackageFile<NpmManagerData>[]> {
  const packageFiles: NpmrcPackageFile<NpmManagerData>[] = [];
  const allLockFiles = matchedFiles.filter(
    (file) =>
      matchesFileName(file, 'bun.lock') || matchesFileName(file, 'bun.lockb'),
  );
  if (allLockFiles.length === 0) {
    logger.debug('No bun lockfiles found');
    return packageFiles;
  }
  const allPackageJson = matchedFiles.filter((file) =>
    matchesFileName(file, 'package.json'),
  );
  for (const lockFile of allLockFiles) {
    const packageFile = getSiblingFileName(lockFile, 'package.json');
    const res = await processPackageFile(packageFile, config);
    if (res) {
      packageFiles.push({ ...res, lockFiles: [lockFile] });
    }
    // Check if package.json contains workspaces
    let workspaces = res?.managerData?.workspaces;

    // Check for nested packages property https://bun.com/docs/pm/catalogs#1-define-catalogs-in-root-package-json
    if (isObject(workspaces) && 'packages' in workspaces) {
      workspaces = workspaces.packages;
    }

    if (!isArray(workspaces, isString)) {
      continue;
    }

    logger.debug(`Found bun workspaces in ${packageFile}`);
    const pwd = getParentDir(packageFile);
    const workspacePackageFiles = filesMatchingWorkspaces(
      pwd,
      allPackageJson,
      workspaces,
    );
    if (workspacePackageFiles.length) {
      logger.debug({ workspacePackageFiles }, 'Found bun workspace files');
      for (const workspaceFile of workspacePackageFiles) {
        const res = await processPackageFile(workspaceFile, config);
        if (res) {
          packageFiles.push({ ...res, lockFiles: [lockFile] });
        }
      }
    }
  }

  return packageFiles;
}
