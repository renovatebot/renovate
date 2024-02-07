import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';
import { NpmDatasource } from '../../../datasource/npm';

import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { NpmLockFiles, NpmManagerData } from '../types';
import { getExtractedConstraints } from './common/dependency';
import { extractPackageJson } from './common/package-file';
import { postExtract } from './post';
import type { NpmPackage } from './types';
import { isZeroInstall } from './yarn';
import {
  YarnConfig,
  loadConfigFromLegacyYarnrc,
  loadConfigFromYarnrcYml,
  resolveRegistryUrl,
} from './yarnrc';

function hasMultipleLockFiles(lockFiles: NpmLockFiles): boolean {
  return Object.values(lockFiles).filter(is.string).length > 1;
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
  } catch (err) {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }

  const res = extractPackageJson(packageJson, packageFile);
  if (!res) {
    return null;
  }

  let workspacesPackages: string[] | undefined;
  if (is.array(packageJson.workspaces)) {
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

  let npmrc: string | undefined;
  const npmrcFileName = getSiblingFileName(packageFile, '.npmrc');
  let repoNpmrc = await readLocalFile(npmrcFileName, 'utf8');
  if (is.string(repoNpmrc)) {
    if (is.string(config.npmrc) && !config.npmrcMerge) {
      logger.debug(
        { npmrcFileName },
        'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
      );
      npmrc = config.npmrc;
    } else {
      npmrc = config.npmrc ?? '';
      if (npmrc.length) {
        if (!npmrc.endsWith('\n')) {
          npmrc += '\n';
        }
      }
      if (repoNpmrc?.includes('package-lock')) {
        logger.debug('Stripping package-lock setting from .npmrc');
        repoNpmrc = repoNpmrc.replace(
          regEx(/(^|\n)package-lock.*?(\n|$)/g),
          '\n',
        );
      }
      if (repoNpmrc.includes('=${') && !GlobalConfig.get('exposeAllEnv')) {
        logger.debug(
          { npmrcFileName },
          'Stripping .npmrc file of lines with variables',
        );
        repoNpmrc = repoNpmrc
          .split(newlineRegex)
          .filter((line) => !line.includes('=${'))
          .join('\n');
      }
      npmrc += repoNpmrc;
    }
  } else if (is.string(config.npmrc)) {
    npmrc = config.npmrc;
  }

  const yarnrcYmlFileName = getSiblingFileName(packageFile, '.yarnrc.yml');
  const yarnZeroInstall = await isZeroInstall(yarnrcYmlFileName);

  let yarnConfig: YarnConfig | null = null;
  const repoYarnrcYml = await readLocalFile(yarnrcYmlFileName, 'utf8');
  if (is.string(repoYarnrcYml) && repoYarnrcYml.trim().length > 0) {
    yarnConfig = loadConfigFromYarnrcYml(repoYarnrcYml);
  }

  const legacyYarnrcFileName = getSiblingFileName(packageFile, '.yarnrc');
  const repoLegacyYarnrc = await readLocalFile(legacyYarnrcFileName, 'utf8');
  if (is.string(repoLegacyYarnrc) && repoLegacyYarnrc.trim().length > 0) {
    yarnConfig = loadConfigFromLegacyYarnrc(repoLegacyYarnrc);
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

  if (yarnConfig) {
    for (const dep of res.deps) {
      if (dep.depName) {
        const registryUrlFromYarnConfig = resolveRegistryUrl(
          dep.depName,
          yarnConfig,
        );
        if (registryUrlFromYarnConfig && dep.datasource === NpmDatasource.id) {
          dep.registryUrls = [registryUrlFromYarnConfig];
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
      hasPackageManager: is.nonEmptyStringAndNotWhitespace(
        packageJson.packageManager,
      ),
      workspacesPackages,
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
    // istanbul ignore else
    if (content) {
      const deps = await extractPackageFile(content, packageFile, config);
      if (deps) {
        npmFiles.push({
          ...deps,
          packageFile,
        });
      }
    } else {
      logger.debug({ packageFile }, `No content found`);
    }
  }

  await postExtract(npmFiles);
  return npmFiles;
}
