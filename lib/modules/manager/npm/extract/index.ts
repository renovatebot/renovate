import {
  isArray,
  isNonEmptyStringAndNotWhitespace,
  isString,
} from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  getSiblingFileName,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';

import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../../types.ts';
import { resolveNpmrc } from '../npmrc.ts';
import { PnpmWorkspaceFile, type YarnConfig } from '../schema.ts';
import type { NpmLockFiles, NpmManagerData } from '../types.ts';
import { getExtractedConstraints } from './common/dependency.ts';
import {
  extractPackageJson,
  hasDevEnginesPackageManager,
  hasPackageManager,
} from './common/package-file.ts';
import { extractPnpmWorkspaceFile } from './pnpm.ts';
import { postExtract } from './post/index.ts';
import type { NpmPackage } from './types.ts';
import { extractYarnCatalogs, isZeroInstall } from './yarn.ts';
import {
  loadConfigFromLegacyYarnrc,
  loadConfigFromYarnrcYml,
  resolveRegistryUrl,
} from './yarnrc.ts';

function hasMultipleLockFiles(lockFiles: NpmLockFiles): boolean {
  return Object.values(lockFiles).filter(isString).length > 1;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFileContent<NpmManagerData> | null> {
  logger.trace(`npm.extractPackageFile(${packageFile})`);
  logger.trace({ content });
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(content);
  } catch {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }

  const res = extractPackageJson(packageJson, packageFile);
  if (!res) {
    return null;
  }

  let workspacesPackages: string[] | undefined;
  if (isArray(packageJson.workspaces)) {
    workspacesPackages = packageJson.workspaces;
  } else {
    workspacesPackages = packageJson.workspaces?.packages;
  }

  const lockFiles: NpmLockFiles = {
    yarnLock: 'yarn.lock',
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
    pnpmShrinkwrap: 'pnpm-lock.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles) as [
    'yarnLock' | 'packageLock' | 'shrinkwrapJson' | 'pnpmShrinkwrap',
    string,
  ][]) {
    const filePath = getSiblingFileName(packageFile, val);
    if (await readLocalFile(filePath, 'utf8')) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  lockFiles.npmLock = lockFiles.packageLock ?? lockFiles.shrinkwrapJson;
  delete lockFiles.packageLock;
  delete lockFiles.shrinkwrapJson;

  if (hasMultipleLockFiles(lockFiles)) {
    logger.warn(
      'Updating multiple npm lock files is deprecated and support will be removed in future versions.',
    );
  }

  const { npmrc, npmrcFileName } = await resolveNpmrc(packageFile, config);

  const yarnrcYmlFileName = await findLocalSiblingOrParent(
    packageFile,
    '.yarnrc.yml',
  );
  const yarnZeroInstall = yarnrcYmlFileName
    ? await isZeroInstall(yarnrcYmlFileName)
    : false;

  let yarnrcConfig: YarnConfig | null = null;
  const repoYarnrcYml = yarnrcYmlFileName
    ? await readLocalFile(yarnrcYmlFileName, 'utf8')
    : null;
  if (isString(repoYarnrcYml) && repoYarnrcYml.trim().length > 0) {
    yarnrcConfig = loadConfigFromYarnrcYml(repoYarnrcYml);
  }

  const legacyYarnrcFileName = await findLocalSiblingOrParent(
    packageFile,
    '.yarnrc',
  );
  const repoLegacyYarnrc = legacyYarnrcFileName
    ? await readLocalFile(legacyYarnrcFileName, 'utf8')
    : null;
  if (isString(repoLegacyYarnrc) && repoLegacyYarnrc.trim().length > 0) {
    yarnrcConfig = loadConfigFromLegacyYarnrc(repoLegacyYarnrc);
  }

  if (res.deps.length === 0) {
    logger.debug('Package file has no deps');
    if (
      !(
        !!res.managerData?.packageJsonName ||
        !!res.packageFileVersion ||
        !!npmrc ||
        workspacesPackages
      )
    ) {
      logger.debug('Skipping file');
      return null;
    }
  }
  let skipInstalls = config.skipInstalls;
  if (skipInstalls === null) {
    const hasFancyRefs = !!res.deps.some(
      (dep) =>
        !!dep.currentValue?.startsWith('file:') ||
        !!dep.currentValue?.startsWith('npm:'),
    );
    if ((hasFancyRefs && !!lockFiles.npmLock) || yarnZeroInstall) {
      // https://github.com/npm/cli/issues/1432
      // Explanation:
      //  - npm install --package-lock-only is buggy for transitive deps in file: and npm: references
      //  - So we set skipInstalls to false if file: or npm: refs are found *and* the user hasn't explicitly set the value already
      //  - Also, do not skip install if Yarn zero-install is used
      logger.debug('Automatically setting skipInstalls to false');
      skipInstalls = false;
    } else {
      skipInstalls = true;
    }
  }

  const extractedConstraints = getExtractedConstraints(res.deps);

  if (yarnrcConfig) {
    for (const dep of res.deps) {
      // v8 ignore else -- TODO: add tests #40625
      if (dep.depName) {
        const registryUrlFromYarnrcConfig = resolveRegistryUrl(
          dep.packageName ?? dep.depName,
          yarnrcConfig,
        );
        if (
          registryUrlFromYarnrcConfig &&
          dep.datasource === NpmDatasource.id
        ) {
          dep.registryUrls = [registryUrlFromYarnrcConfig];
        }
      }
    }
  }

  return {
    ...res,
    npmrc,
    managerData: {
      ...res.managerData,
      ...lockFiles,
      yarnZeroInstall,
      hasPackageManager:
        isNonEmptyStringAndNotWhitespace(packageJson.packageManager) ||
        hasDevEnginesPackageManager(packageJson),
      workspacesPackages,
      npmrcFileName, // store npmrc file name so we can later tell if it came from the workspace or not
    },
    skipInstalls,
    extractedConstraints,
  };
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile<NpmManagerData>[]> {
  const npmFiles: PackageFile<NpmManagerData>[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      // pnpm workspace files are their own package file, defined via managerFilePatterns.
      if (packageFile.endsWith('pnpm-workspace.yaml')) {
        logger.trace(
          { packageFile },
          `Extracting as a pnpm-workspace.yaml file`,
        );
        const parsedPnpmWorkspaceYaml =
          await PnpmWorkspaceFile.safeParseAsync(content);
        if (parsedPnpmWorkspaceYaml.success) {
          logger.trace(
            { packageFile },
            `Extracting file as a pnpm workspace YAML file`,
          );
          const deps = await extractPnpmWorkspaceFile(
            parsedPnpmWorkspaceYaml.data,
            packageFile,
          );
          // v8 ignore else -- TODO: add test #40625
          if (deps) {
            npmFiles.push({
              ...deps,
              packageFile,
            });
          }
        } else {
          logger.warn(
            { packageFile, err: parsedPnpmWorkspaceYaml.error },
            `Failed to parse pnpm-workspace.yaml file`,
          );
        }
      } else {
        if (packageFile.endsWith('json')) {
          logger.trace({ packageFile }, `Extracting as a package.json file`);

          const deps = await extractPackageFile(content, packageFile, config);
          // v8 ignore else -- TODO: add tests #40625
          if (deps) {
            npmFiles.push({
              ...deps,
              packageFile,
            });
          }
        } else {
          logger.trace({ packageFile }, `Extracting as a .yarnrc.yml file`);

          const yarnConfig = loadConfigFromYarnrcYml(content);

          // v8 ignore else -- TODO: add tests #40625
          if (yarnConfig?.catalogs || yarnConfig?.catalog) {
            const hasPackageManagerResult = await hasPackageManager(
              upath.dirname(packageFile),
            );
            const catalogsDeps = await extractYarnCatalogs(
              { catalog: yarnConfig.catalog, catalogs: yarnConfig.catalogs },
              packageFile,
              hasPackageManagerResult,
            );
            // v8 ignore else -- TODO: add tests #40625
            if (catalogsDeps) {
              npmFiles.push({
                ...catalogsDeps,
                packageFile,
              });
            }
          }
        }
      }
    } else {
      logger.debug({ packageFile }, `No content found`);
    }
  }

  await postExtract(npmFiles);
  return npmFiles;
}
