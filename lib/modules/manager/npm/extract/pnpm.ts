import is from '@sindresorhus/is';
import { findPackages } from 'find-packages';
import { load } from 'js-yaml';
import semver from 'semver';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import {
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs';
import { regEx } from '../../../../util/regex';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import type { LockFile, LockFileEntry, PnpmWorkspaceFile } from './types';

export async function extractPnpmFilters(
  fileName: string
): Promise<string[] | undefined> {
  try {
    // TODO #7154
    const contents = load((await readLocalFile(fileName, 'utf8'))!, {
      json: true,
    }) as PnpmWorkspaceFile;
    if (
      !Array.isArray(contents.packages) ||
      !contents.packages.every((item) => is.string(item))
    ) {
      logger.trace(
        { fileName },
        'Failed to find required "packages" array in pnpm-workspace.yaml'
      );
      return undefined;
    }
    return contents.packages;
  } catch (err) {
    logger.trace({ fileName, err }, 'Failed to parse pnpm-workspace.yaml');
    return undefined;
  }
}

export async function findPnpmWorkspace(
  packageFile: string
): Promise<{ lockFilePath: string; workspaceYamlPath: string } | null> {
  // search for pnpm-workspace.yaml
  const workspaceYamlPath = await findLocalSiblingOrParent(
    packageFile,
    'pnpm-workspace.yaml'
  );
  if (!workspaceYamlPath) {
    logger.trace(
      { packageFile },
      'Failed to locate pnpm-workspace.yaml in a parent directory.'
    );
    return null;
  }

  // search for pnpm-lock.yaml next to pnpm-workspace.yaml
  const pnpmLockfilePath = getSiblingFileName(
    workspaceYamlPath,
    'pnpm-lock.yaml'
  );
  if (!(await localPathExists(pnpmLockfilePath))) {
    logger.trace(
      { workspaceYamlPath, packageFile },
      'Failed to find a pnpm-lock.yaml sibling for the workspace.'
    );
    return null;
  }

  return {
    lockFilePath: pnpmLockfilePath,
    workspaceYamlPath,
  };
}

export async function detectPnpmWorkspaces(
  packageFiles: Partial<PackageFile<NpmManagerData>>[]
): Promise<void> {
  logger.debug(`Detecting pnpm Workspaces`);
  const packagePathCache = new Map<string, string[] | null>();

  for (const p of packageFiles) {
    const { packageFile, managerData } = p;
    const { pnpmShrinkwrap } = managerData as NpmManagerData;

    // check if pnpmShrinkwrap-file has already been provided
    if (pnpmShrinkwrap) {
      logger.trace(
        { packageFile, pnpmShrinkwrap },
        'Found an existing pnpm shrinkwrap file; skipping pnpm monorepo check.'
      );
      continue;
    }

    // search for corresponding pnpm workspace
    // TODO #7154
    const pnpmWorkspace = await findPnpmWorkspace(packageFile!);
    if (pnpmWorkspace === null) {
      continue;
    }
    const { workspaceYamlPath, lockFilePath } = pnpmWorkspace;

    // check if package matches workspace filter
    if (!packagePathCache.has(workspaceYamlPath)) {
      const filters = await extractPnpmFilters(workspaceYamlPath);
      const { localDir } = GlobalConfig.get();
      const packages = await findPackages(
        upath.dirname(upath.join(localDir, workspaceYamlPath)),
        {
          patterns: filters,
          // Match the ignores used in @pnpm/find-workspace-packages
          ignore: ['**/node_modules/**', '**/bower_components/**'],
        }
      );
      const packagePaths = packages.map((pkg) =>
        upath.join(pkg.dir, 'package.json')
      );
      packagePathCache.set(workspaceYamlPath, packagePaths);
    }
    const packagePaths = packagePathCache.get(workspaceYamlPath);

    const isPackageInWorkspace = packagePaths?.some((p) =>
      p.endsWith(packageFile!)
    );

    if (isPackageInWorkspace) {
      p.managerData ??= {};
      p.managerData.pnpmShrinkwrap = lockFilePath;
    } else {
      logger.trace(
        { packageFile, workspaceYamlPath },
        `Didn't find the package in the pnpm workspace`
      );
    }
  }
}

export async function getPnpmLock(filePath: string): Promise<LockFile> {
  // TODO #7154
  const pnpmLockRaw = (await readLocalFile(filePath, 'utf8'))!;
  try {
    const lockParsed = load(pnpmLockRaw) as Record<string, any>;
    if (!lockParsed) {
      logger.debug('pnpm lockfile is empty or invalid');
      return { lockedVersions: {} };
    }

    logger.debug({ lockParsed }, 'pnpm lockfile parsed');
    const lockedVersions: Record<string, string> = {};
    const packagePathRegex = regEx(
      /^\/(?<packageName>.+)(?:@|\/)(?<version>[^/@]+)$/
    ); // eg. "/<packageName>(@|/)<version>"

    for (const packagePath of Object.keys(
      (lockParsed.packages || {}) as LockFileEntry
    )) {
      const result = packagePath.match(packagePathRegex);
      if (result?.groups) {
        const packageName = result.groups.packageName;
        const version = result.groups.version;
        logger.debug({
          packagePath,
          packageName,
          version,
        });
        lockedVersions[packageName] = version;
      }
    }
    logger.debug(
      { lockedVersions, lockfileVersion: lockParsed.lockfileVersion },
      'pnpm lockfile parsed'
    );
    return {
      lockedVersions,
      lockfileVersion: parseFloat(lockParsed.lockfileVersion),
    };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing pnpm lockfile');
    return { lockedVersions: {} };
  }
}

export function getConstraints(
  lockfileVersion: number,
  constraints?: string
): string {
  let newConstraints = constraints;

  // find matching lockfileVersion
  // fallback to version:5 if no match is found   -- this is safe as only lockfileVersion >= 5 can use the name `pnpm-lock.yaml`
  const { maxNAVersion, constraint: versionConstraint } =
    lockToPnpmVersionMapping.find(
      (m) => m.lockfileVersion === lockfileVersion
    ) ?? {
      lockfileVersion: 5.0,
      maxNAVersion: '2.24.0',
      constraint: '>=3.0.0',
    };

  if (newConstraints && semver.satisfies(maxNAVersion, newConstraints)) {
    newConstraints += ' ' + versionConstraint;
  } else {
    newConstraints = versionConstraint;
  }

  if (lockfileVersion !== 6.0 && semver.satisfies('8.0.0', newConstraints)) {
    newConstraints += '<8';
  }
  return newConstraints;
}

// lockfileVersion, maxNotAllowedVersion, minAllowedVersion
const lockToPnpmVersionMapping = [
  { lockfileVersion: 6.0, maxNAVersion: '7.32.0', constraint: '>=8' },
  { lockfileVersion: 5.4, maxNAVersion: '6.35.1', constraint: '>=7' },
  { lockfileVersion: 5.3, maxNAVersion: '5.18.0', constraint: '>=6' },
  { lockfileVersion: 5.2, maxNAVersion: '5.9.3', constraint: '>=5.10.0' },
  { lockfileVersion: 5.1, maxNAVersion: '3.4.1', constraint: '>=3.5.0' },
];
