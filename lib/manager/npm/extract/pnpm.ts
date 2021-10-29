import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import {
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import type { PackageFile } from '../../types';
import type { PnpmWorkspaceFile } from './types';
import { matchesAnyPattern } from './utils';

export async function extractPnpmFilters(
  fileName: string
): Promise<string[] | null> {
  try {
    const contents = load(await readLocalFile(fileName, 'utf8'), {
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
      return null;
    }
    return contents.packages;
  } catch (err) {
    logger.trace({ fileName, err }, 'Failed to parse pnpm-workspace.yaml');
    return null;
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
  packageFiles: Partial<PackageFile>[]
): Promise<void> {
  logger.debug(`Detecting pnpm Workspaces`);
  const packageFilterCache = new Map<string, string[] | null>();

  for (const p of packageFiles) {
    const { packageFile, pnpmShrinkwrap } = p;

    // check if pnpmShrinkwrap-file has already been provided
    if (pnpmShrinkwrap) {
      logger.trace(
        { packageFile, pnpmShrinkwrap },
        'Found an existing pnpm shrinkwrap file; skipping pnpm monorepo check.'
      );
      continue; // eslint-disable-line no-continue
    }

    // search for corresponding pnpm workspace
    const pnpmWorkspace = await findPnpmWorkspace(packageFile);
    if (pnpmWorkspace === null) {
      continue; // eslint-disable-line no-continue
    }
    const { workspaceYamlPath, lockFilePath } = pnpmWorkspace;

    // check if package matches workspace filter
    if (!packageFilterCache.has(workspaceYamlPath)) {
      const filters = await extractPnpmFilters(workspaceYamlPath);
      packageFilterCache.set(workspaceYamlPath, filters);
    }
    const packageFilters = packageFilterCache.get(workspaceYamlPath);
    const isPackageInWorkspace =
      packageFilters !== null &&
      matchesAnyPattern(
        packageFile,
        packageFilters.map((filter) => filter.replace(/\/?$/, '/package.json')) // TODO #12070 #12071
      );
    if (isPackageInWorkspace) {
      p.pnpmShrinkwrap = lockFilePath;
    } else {
      logger.trace(
        { packageFile, workspaceYamlPath },
        `Didn't find the package in the pnpm workspace`
      );
    }
  }
}
