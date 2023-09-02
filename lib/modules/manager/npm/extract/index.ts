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
import {
  extractDependency,
  extractOverrideDepsRec,
  parseDepName,
  setNodeCommitTopic,
} from './common';
import { getLockedVersions } from './locked-versions';
import { detectMonorepos } from './monorepo';
import type { NpmPackage, NpmPackageDependency } from './types';

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
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
  };

  for (const [key, val] of Object.entries(lockFiles) as [
    'packageLock' | 'shrinkwrapJson',
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
        workspacesPackages
      )
    ) {
      logger.debug('Skipping file');
      return null;
    }
  }
  const extractedConstraints: Record<string, any> = {};
  const engines = ['node', 'npm', 'yarn', 'pnpm', 'vscode'];
  for (const engine of engines) {
    const constraint = deps.find((dep) => dep.depName === engine);
    if (constraint?.currentValue && !constraint?.skipReason) {
      extractedConstraints[engine] = constraint.currentValue;
    }
  }
  const hasFancyRefs = deps.some(
    (dep) => dep.npmPackageAlias ?? dep.currentValue?.startsWith('file:')
  );

  let skipInstalls = config.skipInstalls;
  if (skipInstalls === null) {
    if (hasFancyRefs && lockFiles.npmLock) {
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

  return {
    deps,
    packageFileVersion,
    npmrc,
    managerData: {
      ...lockFiles,
      packageJsonName,
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
  detectMonorepos(packageFiles);
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
