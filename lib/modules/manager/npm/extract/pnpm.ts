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
import type { PnpmLockFile } from '../post-update/types';
import type { NpmManagerData } from '../types';
import type { LockFile, PnpmWorkspaceFile } from './types';

function isPnpmLockfile(obj: any): obj is PnpmLockFile {
  return is.plainObject(obj) && 'lockfileVersion' in obj;
}

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
  try {
    const pnpmLockRaw = await readLocalFile(filePath, 'utf8');
    if (!pnpmLockRaw) {
      throw new Error('Unable to read pnpm-lock.yaml');
    }

    const lockParsed = load(pnpmLockRaw);
    if (!isPnpmLockfile(lockParsed)) {
      throw new Error('Invalid or empty lockfile');
    }
    logger.trace({ lockParsed }, 'pnpm lockfile parsed');

    // field lockfileVersion is type string in lockfileVersion = 6 and type number in < 6
    const lockfileVersion: number = is.number(lockParsed.lockfileVersion)
      ? lockParsed.lockfileVersion
      : parseFloat(lockParsed.lockfileVersion);

    const lockedVersions: Record<string, string> = {};
    const packagePathRegex = regEx(
      /^\/(?<packageName>.+)(?:@|\/)(?<version>[^/@]+)$/
    ); // eg. "/<packageName>(@|/)<version>"

    for (const packagePath of Object.keys(lockParsed.packages ?? {})) {
      const result = packagePath.match(packagePathRegex);
      if (!result?.groups) {
        logger.trace(`Invalid package path ${packagePath}`);
        continue;
      }

      const packageName = result.groups.packageName;
      const version = result.groups.version;
      logger.trace({
        packagePath,
        packageName,
        version,
      });
      lockedVersions[packageName] = version;
    }
    return {
      lockedVersions,
      lockfileVersion,
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

  // find matching lockfileVersion and use its constraints
  // if no match found use lockfileVersion 5
  // lockfileVersion 5 is the minimum version required to generate the pnpm-lock.yaml file
  const { lowerBound, upperBound, lowerConstraint, upperConstraint } =
    lockToPnpmVersionMapping.find(
      (m) => m.lockfileVersion === lockfileVersion
    ) ?? {
      lockfileVersion: 5.0,
      lowerBound: '2.24.0',
      upperBound: '3.5.0',
      lowerConstraint: '>=3',
      upperConstraint: '<3.5.0',
    };

  // inorder to ensure that the constraint doesn't allow any pnpm versions that can't generate the extracted lockfileVersion
  // compare the current constraint to the lowerBound and upperBound of the lockfileVersion
  // if the current constraint is not comaptible, add the lowerConstraint and upperConstraint, whichever is needed
  if (newConstraints) {
    // if constraint satisfies versions lower than lowerBound add the lowerConstraint to narrow the range
    if (semver.satisfies(lowerBound, newConstraints)) {
      newConstraints += ` ${lowerConstraint}`;
    }

    // if constraint satisfies versions higher than upperBound add the upperConstraint to narrow the range
    if (
      upperBound &&
      upperConstraint &&
      semver.satisfies(upperBound, newConstraints)
    ) {
      newConstraints += ` ${upperConstraint}`;
    }
  }
  // if no constraint is present, add the lowerConstraint and upperConstraint corresponding to the lockfileVersion
  else {
    newConstraints = `${lowerConstraint}${
      upperConstraint ? ` ${upperConstraint}` : ''
    }`;
  }

  return newConstraints;
}

/**
 pnpm lockfiles have corresponding version numbers called "lockfileVersion"
 each lockfileVersion can only be generated by a certain pnpm version ranges
 eg. lockfileVersion: 5.4 can only be generated by pnpm version >=7 && <8
 official list can be found here : https:github.com/pnpm/spec/tree/master/lockfile
 we use the mapping present below to find the compatible pnpm version range for a given lockfileVersion

 the various terms used in the mapping are explained below:
 lowerConstriant : lowest pnpm version that can generate the lockfileVersion
 upperConstraint : highest pnpm version that can generate the lockfileVersion
 lowerBound      : highest pnpm version that is less than the lowerConstraint
 upperBound      : lowest pnpm version that is greater than upperConstraint

 For handling future lockfileVersions, we need to:
 1. add a upperBound and upperConstraint to the current lastest lockfileVersion
 2. add an object for the new lockfileVersion with lowerBound and lowerConstraint
 */

const lockToPnpmVersionMapping = [
  { lockfileVersion: 6.0, lowerBound: '7.32.0', lowerConstraint: '>=8' },
  {
    lockfileVersion: 5.4,
    lowerBound: '6.35.1',
    upperBound: '8.0.0',
    lowerConstraint: '>=7',
    upperConstraint: '<8',
  },
  {
    lockfileVersion: 5.3,
    lowerBound: '5.18.10',
    upperBound: '7.0.0',
    lowerConstraint: '>=6',
    upperConstraint: '<7',
  },
  {
    lockfileVersion: 5.2,
    lowerBound: '5.9.3',
    upperBound: '5.18.10',
    lowerConstraint: '>=5.10.0',
    upperConstraint: '<6',
  },
  {
    lockfileVersion: 5.1,
    lowerBound: '3.4.1',
    upperBound: '5.9.3',
    lowerConstraint: '>=3.5.0',
    upperConstraint: '<5.9.3',
  },
];
