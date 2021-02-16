import is from '@sindresorhus/is';
import findUp from 'find-up';
import yaml from 'js-yaml';
import minimatch from 'minimatch';
import upath from 'upath';
import { logger } from '../../../logger';
import { SkipReason } from '../../../types';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { ExtractConfig, PackageFile } from '../../common';

function matchesAnyPattern(val: string, patterns: string[]): boolean {
  const res = patterns.some(
    (pattern) => pattern === val + '/' || minimatch(val, pattern, { dot: true })
  );
  logger.trace({ val, patterns, res }, `matchesAnyPattern`);
  return res;
}

export async function extractPnpmFilters(
  fileName: string
): Promise<string[] | null> {
  try {
    const contents = yaml.safeLoad(await readLocalFile(fileName, 'utf8'), {
      json: true,
    }) as any;
    if (
      !Array.isArray(contents?.packages) ||
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
  packageFile: string,
  normalizedLocalDir: string
): Promise<{ lockFilePath: string; workspaceYamlPath: string } | null> {
  const workspaceYamlPath = await findUp('pnpm-workspace.yaml', {
    cwd: upath.dirname(upath.join(normalizedLocalDir, packageFile)),
    type: 'file',
  });
  if (
    !workspaceYamlPath ||
    !upath.normalizeSafe(workspaceYamlPath).startsWith(normalizedLocalDir)
  ) {
    logger.trace(
      { packageFile },
      'Failed to locate pnpm-workspace.yaml in a parent directory.'
    );
    return null;
  }
  const normalizedWorkspaceYamlPath = upath
    .normalizeSafe(workspaceYamlPath)
    .slice(normalizedLocalDir.length + 1);
  const pnpmLockfilePath = getSiblingFileName(
    normalizedWorkspaceYamlPath,
    'pnpm-lock.yaml'
  );
  if (!(await localPathExists(pnpmLockfilePath))) {
    logger.trace(
      { normalizedWorkspaceYamlPath, packageFile },
      'Failed to find a pnpm-lock.yaml sibling for the workspace.'
    );
    return null;
  }
  return {
    lockFilePath: pnpmLockfilePath,
    workspaceYamlPath: normalizedWorkspaceYamlPath,
  };
}

export async function detectPnpm(
  config: ExtractConfig,
  packageFiles: Partial<PackageFile>[]
): Promise<void> {
  logger.debug(`Detecting pnpm Workspaces`);
  const packageFilterCache = new Map<string, string[] | null>();
  const normalizedLocalDir = upath.normalizeSafe(config.localDir);
  for (const p of packageFiles) {
    const { packageFile, pnpmShrinkwrap } = p;
    if (pnpmShrinkwrap) {
      logger.debug(
        { packageFile, pnpmShrinkwrap },
        'Found an existing pnpm shrinkwrap file; skipping pnpm monorepo check.'
      );
      continue; // eslint-disable-line no-continue
    }
    const pnpmWorkspace = await findPnpmWorkspace(
      packageFile,
      normalizedLocalDir
    );
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

export async function detectMonorepos(
  config: ExtractConfig,
  packageFiles: Partial<PackageFile>[]
): Promise<void> {
  await detectPnpm(config, packageFiles);
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const {
      packageFile,
      npmLock,
      yarnLock,
      lernaDir,
      lernaClient,
      lernaPackages,
      yarnWorkspacesPackages,
    } = p;
    const basePath = upath.dirname(packageFile);
    const packages = yarnWorkspacesPackages || lernaPackages;
    if (packages?.length) {
      logger.debug(
        { packageFile, yarnWorkspacesPackages, lernaPackages },
        'Found monorepo packages with base path ' + JSON.stringify(basePath)
      );
      const internalPackagePatterns = (is.array(packages)
        ? packages
        : [packages]
      ).map((pattern) => upath.join(basePath, pattern));
      const internalPackageFiles = packageFiles.filter((sp) =>
        matchesAnyPattern(
          upath.dirname(sp.packageFile),
          internalPackagePatterns
        )
      );
      const internalPackageNames = internalPackageFiles
        .map((sp) => sp.packageJsonName)
        .filter(Boolean);
      p.deps?.forEach((dep) => {
        if (internalPackageNames.includes(dep.depName)) {
          dep.skipReason = SkipReason.InternalPackage; // eslint-disable-line no-param-reassign
        }
      });
      for (const subPackage of internalPackageFiles) {
        subPackage.lernaDir = lernaDir;
        subPackage.lernaClient = lernaClient;
        subPackage.yarnLock = subPackage.yarnLock || yarnLock;
        subPackage.npmLock = subPackage.npmLock || npmLock;
        if (subPackage.yarnLock) {
          subPackage.hasYarnWorkspaces = !!yarnWorkspacesPackages;
        }
        subPackage.deps?.forEach((dep) => {
          if (internalPackageNames.includes(dep.depName)) {
            dep.skipReason = SkipReason.InternalPackage; // eslint-disable-line no-param-reassign
          }
        });
      }
    }
  }
}
