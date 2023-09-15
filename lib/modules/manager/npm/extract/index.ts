import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';

import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { NpmLockFiles, NpmManagerData } from '../types';
import { extractDependency, getExtractedConstraints } from './common';
import { setNodeCommitTopic } from './common/node';
import { extractOverrideDepsRec } from './common/overrides';
import { getLockedVersions } from './locked-versions';
import { detectMonorepos } from './monorepo';
import type { NpmPackage, NpmPackageDependency } from './types';
import { isZeroInstall } from './yarn';
import {
  YarnConfig,
  loadConfigFromLegacyYarnrc,
  loadConfigFromYarnrcYml,
  resolveRegistryUrl,
} from './yarnrc';

function parseDepName(depType: string, key: string): string {
  if (depType !== 'resolutions') {
    return key;
  }

  const [, depName] = regEx(/((?:@[^/]+\/)?[^/@]+)$/).exec(key) ?? [];
  return depName;
}

function hasMultipleLockFiles(lockFiles: NpmLockFiles): boolean {
  return Object.values(lockFiles).filter(is.string).length > 1;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent<NpmManagerData> | null> {
  logger.trace(`npm.extractPackageFile(${packageFile})`);
  logger.trace({ content });
  const deps: PackageDependency[] = [];
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }

  if (packageJson._id && packageJson._args && packageJson._from) {
    logger.debug({ packageFile }, 'Ignoring vendorised package.json');
    return null;
  }
  if (packageFile !== 'package.json' && packageJson.renovate) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = packageFile;
    error.validationError =
      'Nested package.json must not contain Renovate configuration. Please use `packageRules` with `matchFileNames` in your main config instead.';
    throw error;
  }
  const packageJsonName = packageJson.name;
  logger.debug(
    `npm file ${packageFile} has name ${JSON.stringify(packageJsonName)}`
  );
  const packageFileVersion = packageJson.version;
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
    string
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
      'Updating multiple npm lock files is deprecated and support will be removed in future versions.'
    );
  }

  let npmrc: string | undefined;
  const npmrcFileName = getSiblingFileName(packageFile, '.npmrc');
  let repoNpmrc = await readLocalFile(npmrcFileName, 'utf8');
  if (is.string(repoNpmrc)) {
    if (is.string(config.npmrc) && !config.npmrcMerge) {
      logger.debug(
        { npmrcFileName },
        'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false'
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
          '\n'
        );
      }
      if (repoNpmrc.includes('=${') && !GlobalConfig.get('exposeAllEnv')) {
        logger.debug(
          { npmrcFileName },
          'Stripping .npmrc file of lines with variables'
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
  if (is.string(repoYarnrcYml)) {
    yarnConfig = loadConfigFromYarnrcYml(repoYarnrcYml);
  }

  const legacyYarnrcFileName = getSiblingFileName(packageFile, '.yarnrc');
  const repoLegacyYarnrc = await readLocalFile(legacyYarnrcFileName, 'utf8');
  if (is.string(repoLegacyYarnrc)) {
    yarnConfig = loadConfigFromLegacyYarnrc(repoLegacyYarnrc);
  }

  let lernaJsonFile: string | undefined;
  let lernaPackages: string[] | undefined;
  let lernaClient: 'yarn' | 'npm' | undefined;
  let lernaJson:
    | {
        packages: string[];
        npmClient: string;
        useWorkspaces?: boolean;
      }
    | undefined;
  try {
    lernaJsonFile = getSiblingFileName(packageFile, 'lerna.json');
    // TODO #22198
    lernaJson = JSON.parse((await readLocalFile(lernaJsonFile, 'utf8'))!);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, lernaJsonFile }, 'Could not parse lerna.json');
  }
  if (lernaJson && !lernaJson.useWorkspaces) {
    lernaPackages = lernaJson.packages;
    lernaClient =
      lernaJson.npmClient === 'yarn' || lockFiles.yarnLock ? 'yarn' : 'npm';
  } else {
    lernaJsonFile = undefined;
  }

  const depTypes = {
    dependencies: 'dependency',
    devDependencies: 'devDependency',
    optionalDependencies: 'optionalDependency',
    peerDependencies: 'peerDependency',
    engines: 'engine',
    volta: 'volta',
    resolutions: 'resolutions',
    packageManager: 'packageManager',
    overrides: 'overrides',
  };

  for (const depType of Object.keys(depTypes) as (keyof typeof depTypes)[]) {
    let dependencies = packageJson[depType];
    if (dependencies) {
      try {
        if (depType === 'packageManager') {
          const match = regEx('^(?<name>.+)@(?<range>.+)$').exec(
            dependencies as string
          );
          // istanbul ignore next
          if (!match?.groups) {
            break;
          }
          dependencies = { [match.groups.name]: match.groups.range };
        }
        for (const [key, val] of Object.entries(
          dependencies as NpmPackageDependency
        )) {
          const depName = parseDepName(depType, key);
          let dep: PackageDependency = {
            depType,
            depName,
          };
          if (depName !== key) {
            dep.managerData = { key };
          }
          if (depType === 'overrides' && !is.string(val)) {
            // TODO: fix type #22198
            deps.push(
              ...extractOverrideDepsRec(
                [depName],
                val as unknown as NpmManagerData
              )
            );
          } else {
            // TODO: fix type #22198
            dep = { ...dep, ...extractDependency(depType, depName, val!) };
            setNodeCommitTopic(dep);
            dep.prettyDepType = depTypes[depType];
            deps.push(dep);
          }
        }
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { fileName: packageFile, depType, err },
          'Error parsing package.json'
        );
        return null;
      }
    }
  }
  if (deps.length === 0) {
    logger.debug('Package file has no deps');
    if (
      !(
        !!packageJsonName ||
        !!packageFileVersion ||
        !!npmrc ||
        !!lernaJsonFile ||
        workspacesPackages
      )
    ) {
      logger.debug('Skipping file');
      return null;
    }
  }
  let skipInstalls = config.skipInstalls;
  if (skipInstalls === null) {
    const hasFancyRefs = !!deps.some(
      (dep) =>
        !!dep.currentValue?.startsWith('file:') ||
        !!dep.currentValue?.startsWith('npm:')
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

  const extractedConstraints = getExtractedConstraints(deps);

  if (yarnConfig) {
    for (const dep of deps) {
      if (dep.depName) {
        const registryUrlFromYarnConfig = resolveRegistryUrl(
          dep.depName,
          yarnConfig
        );
        if (registryUrlFromYarnConfig) {
          dep.registryUrls = [registryUrlFromYarnConfig];
        }
      }
    }
  }

  return {
    deps,
    packageFileVersion,
    npmrc,
    managerData: {
      ...lockFiles,
      lernaClient,
      lernaJsonFile,
      lernaPackages,
      packageJsonName,
      yarnZeroInstall,
      hasPackageManager: is.nonEmptyStringAndNotWhitespace(
        packageJson.packageManager
      ),
      workspacesPackages,
    },
    skipInstalls,
    extractedConstraints,
  };
}

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
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
