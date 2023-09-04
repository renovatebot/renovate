import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { join } from 'upath';
import { logger } from '../../../../logger';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../../util/fs';
import { scm } from '../../../platform/scm';
import { extractPackageJson } from '../../npm/extract/common';
import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { NpmLockFiles, NpmManagerData } from '../types';
import { getLockedVersions } from './locked-versions';
import type { NpmPackage } from './types';
import { matchesAnyPattern } from './utils';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent<NpmManagerData> | null> {
  logger.trace(`npm.extractPackageFile(${packageFile})`);
  logger.trace({ content });
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }
  const res = await extractPackageJson(packageFile, packageJson, config);
  if (!res) {
    return res;
  }
  await postExtractPackageFile(packageFile, config, res);
  return res;
}

export async function postExtractPackageFile(
  packageFile: string,
  config: ExtractConfig,
  res: PackageFileContent<NpmManagerData>
): Promise<void> {
  const lockFiles: NpmLockFiles = {
    pnpmShrinkwrap: 'pnpm-lock.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles) as [
    'pnpmShrinkwrap',
    string
  ][]) {
    const filePath = getSiblingFileName(packageFile, val);
    if (await readLocalFile(filePath, 'utf8')) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  res.managerData = { ...lockFiles, ...res.managerData };
}

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  await getLockedVersions(packageFiles);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  fileMatches: string[]
): Promise<PackageFile<NpmManagerData>[]> {
  // Ensure the matched files are pnpm lock files
  const pnpmLocks = fileMatches.filter(
    (fileName) =>
      fileName === 'pnpm-lock.yaml' || fileName.endsWith('/pnpm-lock.yaml')
  );
  const packageFiles: Record<string, string> = {};
  for (const pnpmLock of pnpmLocks) {
    // find sibling package.json file and parse it
    const packageFile = getSiblingFileName(pnpmLock, 'package.json');
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      continue;
    }
    // Only use the file if it parses
    try {
      JSON.parse(content);
      packageFiles[packageFile] = pnpmLock;
    } catch (err) {
      logger.debug({ packageFile }, `Invalid JSON`);
      continue;
    }
    // Find the pnpm-workspace.yaml
    const workspaceFile = getSiblingFileName(
      packageFile,
      'pnpm-workspace.yaml'
    );
    const workspaceContent = await readLocalFile(workspaceFile, 'utf8');
    if (!workspaceContent) {
      logger.debug({ workspaceFile }, `No workspace file found`);
      continue;
    }
    // Validate the YAML content
    let workspaceYaml: any;
    try {
      workspaceYaml = workspaceContent ? yaml.load(workspaceContent) : {};
    } catch (err) {
      logger.debug({ workspaceFile }, `Invalid YAML`);
      continue;
    }
    logger.debug({ workspaceYaml }, `Found workspace file`);
    if (!is.array(workspaceYaml.packages)) {
      continue;
    }
    const includePatterns = workspaceYaml.packages.filter(
      (pattern: unknown) => is.string(pattern) && !pattern.startsWith('!')
    );
    const excludePatterns = workspaceYaml.packages
      .filter(
        (pattern: unknown) => is.string(pattern) && pattern.startsWith('!')
      )
      .map((pattern: string) => pattern.slice(1));
    const fileList = await scm.getFileList();
    const uniqueDirs = [
      ...new Set(fileList.map((fileName) => getParentDir(fileName))),
    ];
    const matchingDirs = uniqueDirs.filter((dir) => {
      return (
        matchesAnyPattern(dir, includePatterns) &&
        !matchesAnyPattern(dir, excludePatterns)
      );
    });
    const internalPackageFiles = matchingDirs
      .map((dir) => join(dir, 'package.json'))
      .filter((fileName) => fileList.includes(fileName));
    logger.debug(
      { workspaceFile, internalPackageFiles },
      `Found internal package files`
    );
    for (const internalPackageFile of internalPackageFiles) {
      packageFiles[internalPackageFile] = pnpmLock;
    }
  }

  const npmFiles: PackageFile<NpmManagerData>[] = [];
  for (const [packageFile, pnpmLock] of Object.entries(packageFiles)) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      const deps = await extractPackageFile(content, packageFile, config);
      if (deps) {
        npmFiles.push({
          ...deps,
          packageFile,
          lockFiles: [pnpmLock],
        });
      }
    } else {
      logger.debug({ packageFile }, `No content found`);
    }
  }

  await postExtract(npmFiles);
  return npmFiles;
}
