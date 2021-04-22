import is from '@sindresorhus/is';
import validateNpmPackageName from 'validate-npm-package-name';
import { getAdminConfig } from '../../../config/admin';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import * as datasourceGithubTags from '../../../datasource/github-tags';
import { id as npmId } from '../../../datasource/npm';
import { logger } from '../../../logger';
import { SkipReason } from '../../../types';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import * as nodeVersioning from '../../../versioning/node';
import { isValid, isVersion } from '../../../versioning/npm';
import type {
  ExtractConfig,
  NpmLockFiles,
  PackageDependency,
  PackageFile,
} from '../../types';
import { getLockedVersions } from './locked-versions';
import { detectMonorepos } from './monorepo';
import { mightBeABrowserLibrary } from './type';
import type { NpmPackage, NpmPackageDependency } from './types';

function parseDepName(depType: string, key: string): string {
  if (depType !== 'resolutions') {
    return key;
  }

  const [, depName] = /((?:@[^/]+\/)?[^/@]+)$/.exec(key);
  return depName;
}

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  logger.trace(`npm.extractPackageFile(${fileName})`);
  logger.trace({ content });
  const deps: PackageDependency[] = [];
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.debug({ fileName }, 'Invalid JSON');
    return null;
  }
  // eslint-disable-next-line no-underscore-dangle
  if (packageJson._id && packageJson._args && packageJson._from) {
    logger.debug('Ignoring vendorised package.json');
    return null;
  }
  if (fileName !== 'package.json' && packageJson.renovate) {
    const error = new Error(CONFIG_VALIDATION);
    error.location = fileName;
    error.validationError =
      'Nested package.json must not contain renovate configuration. Please use `packageRules` with `matchPaths` in your main config instead.';
    throw error;
  }
  const packageJsonName = packageJson.name;
  logger.debug(
    `npm file ${fileName} has name ${JSON.stringify(packageJsonName)}`
  );
  const packageFileVersion = packageJson.version;
  let yarnWorkspacesPackages: string[];
  if (is.array(packageJson.workspaces)) {
    yarnWorkspacesPackages = packageJson.workspaces;
  } else {
    yarnWorkspacesPackages = packageJson.workspaces?.packages;
  }
  const packageJsonType = mightBeABrowserLibrary(packageJson)
    ? 'library'
    : 'app';

  const lockFiles: NpmLockFiles = {
    yarnLock: 'yarn.lock',
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
    pnpmShrinkwrap: 'pnpm-lock.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles)) {
    const filePath = getSiblingFileName(fileName, val);
    if (await readLocalFile(filePath, 'utf8')) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  lockFiles.npmLock = lockFiles.packageLock || lockFiles.shrinkwrapJson;
  delete lockFiles.packageLock;
  delete lockFiles.shrinkwrapJson;

  let npmrc: string;
  const npmrcFileName = getSiblingFileName(fileName, '.npmrc');
  const npmrcContent = await readLocalFile(npmrcFileName, 'utf8');
  if (is.string(npmrcContent)) {
    if (is.string(config.npmrc)) {
      logger.debug(
        { npmrcFileName },
        'Repo .npmrc file is ignored due to presence of config.npmrc'
      );
    } else {
      npmrc = npmrcContent;
      if (npmrc?.includes('package-lock')) {
        logger.debug('Stripping package-lock setting from .npmrc');
        npmrc = npmrc.replace(/(^|\n)package-lock.*?(\n|$)/g, '\n');
      }
      if (npmrc.includes('=${') && !getAdminConfig().exposeAllEnv) {
        logger.debug(
          { npmrcFileName },
          'Stripping .npmrc file of lines with variables'
        );
        npmrc = npmrc
          .split('\n')
          .filter((line) => !line.includes('=${'))
          .join('\n');
      }
    }
  }
  const yarnrcFileName = getSiblingFileName(fileName, '.yarnrc');
  let yarnrc;
  if (!is.string(config.yarnrc)) {
    yarnrc = (await readLocalFile(yarnrcFileName, 'utf8')) || undefined;
  }

  let lernaJsonFile: string;
  let lernaPackages: string[];
  let lernaClient: 'yarn' | 'npm';
  let hasFancyRefs = false;
  let lernaJson: {
    packages: string[];
    npmClient: string;
    useWorkspaces?: boolean;
  };
  try {
    lernaJsonFile = getSiblingFileName(fileName, 'lerna.json');
    lernaJson = JSON.parse(await readLocalFile(lernaJsonFile, 'utf8'));
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Could not parse lerna.json');
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
  };

  const constraints: Record<string, any> = {};

  function extractDependency(
    depType: string,
    depName: string,
    input: string
  ): PackageDependency {
    const dep: PackageDependency = {};
    if (!validateNpmPackageName(depName).validForOldPackages) {
      dep.skipReason = SkipReason.InvalidName;
      return dep;
    }
    if (typeof input !== 'string') {
      dep.skipReason = SkipReason.InvalidValue;
      return dep;
    }
    dep.currentValue = input.trim();
    if (depType === 'engines') {
      if (depName === 'node') {
        dep.datasource = datasourceGithubTags.id;
        dep.lookupName = 'nodejs/node';
        dep.versioning = nodeVersioning.id;
        constraints.node = dep.currentValue;
      } else if (depName === 'yarn') {
        dep.datasource = npmId;
        dep.commitMessageTopic = 'Yarn';
        constraints.yarn = dep.currentValue;
      } else if (depName === 'npm') {
        dep.datasource = npmId;
        dep.commitMessageTopic = 'npm';
        constraints.npm = dep.currentValue;
      } else if (depName === 'pnpm') {
        dep.datasource = npmId;
        dep.commitMessageTopic = 'pnpm';
        constraints.pnpm = dep.currentValue;
      } else if (depName === 'vscode') {
        dep.datasource = datasourceGithubTags.id;
        dep.lookupName = 'microsoft/vscode';
        constraints.vscode = dep.currentValue;
      } else {
        dep.skipReason = SkipReason.UnknownEngines;
      }
      if (!isValid(dep.currentValue)) {
        dep.skipReason = SkipReason.UnknownVersion;
      }
      return dep;
    }

    // support for volta
    if (depType === 'volta') {
      if (depName === 'node') {
        dep.datasource = datasourceGithubTags.id;
        dep.lookupName = 'nodejs/node';
        dep.versioning = nodeVersioning.id;
      } else if (depName === 'yarn') {
        dep.datasource = npmId;
        dep.commitMessageTopic = 'Yarn';
      } else {
        dep.skipReason = SkipReason.UnknownVolta;
      }
      if (!isValid(dep.currentValue)) {
        dep.skipReason = SkipReason.UnknownVersion;
      }
      return dep;
    }

    if (dep.currentValue.startsWith('npm:')) {
      dep.npmPackageAlias = true;
      hasFancyRefs = true;
      const valSplit = dep.currentValue.replace('npm:', '').split('@');
      if (valSplit.length === 2) {
        dep.lookupName = valSplit[0];
        dep.currentValue = valSplit[1];
      } else if (valSplit.length === 3) {
        dep.lookupName = valSplit[0] + '@' + valSplit[1];
        dep.currentValue = valSplit[2];
      } else {
        logger.debug('Invalid npm package alias: ' + dep.currentValue);
      }
    }
    if (dep.currentValue.startsWith('file:')) {
      dep.skipReason = SkipReason.File;
      hasFancyRefs = true;
      return dep;
    }
    if (isValid(dep.currentValue)) {
      dep.datasource = npmId;
      if (dep.currentValue === '*') {
        dep.skipReason = SkipReason.AnyVersion;
      }
      if (dep.currentValue === '') {
        dep.skipReason = SkipReason.Empty;
      }
      return dep;
    }
    const hashSplit = dep.currentValue.split('#');
    if (hashSplit.length !== 2) {
      dep.skipReason = SkipReason.UnknownVersion;
      return dep;
    }
    const [depNamePart, depRefPart] = hashSplit;
    const githubOwnerRepo = depNamePart
      .replace(/^github:/, '')
      .replace(/^git\+/, '')
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/\.git$/, '');
    const githubRepoSplit = githubOwnerRepo.split('/');
    if (githubRepoSplit.length !== 2) {
      dep.skipReason = SkipReason.UnknownVersion;
      return dep;
    }
    const [githubOwner, githubRepo] = githubRepoSplit;
    const githubValidRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/;
    if (
      !githubValidRegex.test(githubOwner) ||
      !githubValidRegex.test(githubRepo)
    ) {
      dep.skipReason = SkipReason.UnknownVersion;
      return dep;
    }
    if (isVersion(depRefPart)) {
      dep.currentRawValue = dep.currentValue;
      dep.currentValue = depRefPart;
      dep.datasource = datasourceGithubTags.id;
      dep.lookupName = githubOwnerRepo;
      dep.pinDigests = false;
    } else if (
      /^[0-9a-f]{7}$/.test(depRefPart) ||
      /^[0-9a-f]{40}$/.test(depRefPart)
    ) {
      dep.currentRawValue = dep.currentValue;
      dep.currentValue = null;
      dep.currentDigest = depRefPart;
      dep.datasource = datasourceGithubTags.id;
      dep.lookupName = githubOwnerRepo;
    } else {
      dep.skipReason = SkipReason.UnversionedReference;
      return dep;
    }
    dep.githubRepo = githubOwnerRepo;
    dep.sourceUrl = `https://github.com/${githubOwnerRepo}`;
    dep.gitRef = true;
    return dep;
  }

  for (const depType of Object.keys(depTypes)) {
    if (packageJson[depType]) {
      try {
        for (const [key, val] of Object.entries(
          packageJson[depType] as NpmPackageDependency
        )) {
          const depName = parseDepName(depType, key);
          let dep: PackageDependency = {
            depType,
            depName,
          };
          if (depName !== key) {
            dep.managerData = { key };
          }
          dep = { ...dep, ...extractDependency(depType, depName, val) };
          if (depName === 'node') {
            // This is a special case for Node.js to group it together with other managers
            dep.commitMessageTopic = 'Node.js';
          }
          dep.prettyDepType = depTypes[depType];
          deps.push(dep);
        }
      } catch (err) /* istanbul ignore next */ {
        logger.debug({ fileName, depType, err }, 'Error parsing package.json');
        return null;
      }
    }
  }
  if (deps.length === 0) {
    logger.debug('Package file has no deps');
    if (
      !(
        packageJsonName ||
        packageFileVersion ||
        npmrc ||
        lernaJsonFile ||
        yarnWorkspacesPackages
      )
    ) {
      logger.debug('Skipping file');
      return null;
    }
  }
  let skipInstalls = config.skipInstalls;
  if (skipInstalls === null) {
    if (hasFancyRefs) {
      // https://github.com/npm/cli/issues/1432
      // Explanation:
      //  - npm install --package-lock-only is buggy for transitive deps in file: and npm: references
      //  - So we set skipInstalls to false if file: or npm: refs are found *and* the user hasn't explicitly set the value already
      logger.debug('Automatically setting skipInstalls to false');
      skipInstalls = false;
    } else {
      skipInstalls = true;
    }
  }

  return {
    deps,
    packageJsonName,
    packageFileVersion,
    packageJsonType,
    npmrc,
    yarnrc,
    ...lockFiles,
    managerData: {
      lernaJsonFile,
    },
    lernaClient,
    lernaPackages,
    skipInstalls,
    yarnWorkspacesPackages,
    constraints,
  };
}

export async function postExtract(
  packageFiles: PackageFile[],
  updateInternalDeps: boolean
): Promise<void> {
  detectMonorepos(packageFiles, updateInternalDeps);
  await getLockedVersions(packageFiles);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[]> {
  const npmFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
    if (content) {
      const deps = await extractPackageFile(content, packageFile, config);
      if (deps) {
        npmFiles.push({
          packageFile,
          ...deps,
        });
      }
    } else {
      logger.debug({ packageFile }, 'packageFile has no content');
    }
  }
  await postExtract(npmFiles, config.updateInternalDeps);
  return npmFiles;
}
