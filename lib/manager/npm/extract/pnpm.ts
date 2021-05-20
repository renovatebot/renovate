import yaml from 'js-yaml';
import { logger } from '../../../logger';
import {
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import type { PackageFile } from '../../types';
import { PnpmWorkspaceFile } from './types';
import { matchesAnyPattern } from './utils';

export async function extractPnpmFilters(
  fileName: string
): Promise<string[] | null> {
  try {
    const contents = yaml.safeLoad(await readLocalFile(fileName, 'utf8'), {
      json: true,
    }) as PnpmWorkspaceFile;
    if (
      !contents.packages ||
      !contents.packages.every((item) => typeof item === 'string')
    ) {
      logger.debug(
        { fileName },
        'Failed to find required "packages" array in pnpm-workspace.yaml'
      );
      return null;
    }
    return contents.packages;
  } catch (error) {
    logger.debug({ fileName }, 'Failed to parse pnpm-workspace.yaml');
    return null;
  }
}

export async function findPnpmWorkspace(
  packageFile: string
): Promise<{ lockFilePath: string; workspaceYamlPath: string } | null> {
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
    if (pnpmShrinkwrap) {
      logger.debug(
        { packageFile, pnpmShrinkwrap },
        'Found an existing pnpm shrinkwrap file; skipping pnpm monorepo check.'
      );
      continue; // eslint-disable-line no-continue
    }
    const pnpmWorkspace = await findPnpmWorkspace(packageFile);
    if (pnpmWorkspace === null) {
      continue; // eslint-disable-line no-continue
    }
    const { workspaceYamlPath, lockFilePath } = pnpmWorkspace;
    if (!packageFilterCache.has(workspaceYamlPath)) {
      const filters = await extractPnpmFilters(workspaceYamlPath);
      packageFilterCache.set(workspaceYamlPath, filters);
    }
    const packageFilters = packageFilterCache.get(workspaceYamlPath);
    const isPackageInWorkspace =
      packageFilters !== null && matchesAnyPattern(packageFile, packageFilters);
    if (isPackageInWorkspace) {
      p.pnpmShrinkwrap = lockFilePath;
    } else {
      logger.debug(
        { packageFile, workspaceYamlPath },
        `Didn't find the package in the pnpm workspace`
      );
    }
  }
}
