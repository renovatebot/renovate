const path = require('path');
const upath = require('upath');
const validateNpmPackageName = require('validate-npm-package-name');

const { getLockedVersions } = require('./locked-versions');
const { detectMonorepos } = require('./monorepo');
const { mightBeABrowserLibrary } = require('./type');
const semver = require('../../../versioning/npm');

module.exports = {
  extractAllPackageFiles,
  extractPackageFile,
  postExtract,
};

async function extractAllPackageFiles(config, packageFiles) {
  const npmFiles = [];
  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      const deps = await extractPackageFile(content, packageFile, config);
      if (deps) {
        npmFiles.push({
          packageFile,
          manager: 'npm',
          ...deps,
        });
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }
  await postExtract(npmFiles);
  return npmFiles;
}

async function extractPackageFile(content, fileName, config) {
  logger.debug(`npm.extractPackageFile(${fileName})`);
  logger.trace({ content });
  const deps = [];
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ fileName }, 'Invalid JSON');
    return null;
  }
  // eslint-disable-next-line no-underscore-dangle
  if (packageJson._id && packageJson._args && packageJson._from) {
    logger.info('Ignoring vendorised package.json');
    return null;
  }
  if (fileName !== 'package.json' && packageJson.renovate) {
    const error = new Error('config-validation');
    error.configFile = fileName;
    error.validationError =
      'Nested package.json must not contain renovate configuration. Please use `packageRules` with `paths` in your main config instead.';
    throw error;
  }
  const packageJsonName = packageJson.name;
  const packageJsonVersion = packageJson.version;
  let yarnWorkspacesPackages;
  if (packageJson.workspaces && packageJson.workspaces.packages) {
    yarnWorkspacesPackages = packageJson.workspaces.packages;
  } else {
    yarnWorkspacesPackages = packageJson.workspaces;
  }
  const packageJsonType = mightBeABrowserLibrary(packageJson)
    ? 'library'
    : 'app';

  const lockFiles = {
    yarnLock: 'yarn.lock',
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
    pnpmShrinkwrap: 'shrinkwrap.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles)) {
    const filePath = upath.join(path.dirname(fileName), val);
    if (await platform.getFile(filePath)) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  lockFiles.npmLock = lockFiles.packageLock || lockFiles.shrinkwrapJson;
  delete lockFiles.packageLock;
  delete lockFiles.shrinkwrapJson;

  let npmrc;
  if (!config.ignoreNpmrcFile) {
    npmrc = await platform.getFile(
      upath.join(path.dirname(fileName), '.npmrc')
    );
    if (npmrc && npmrc.includes('package-lock')) {
      logger.info('Stripping package-lock setting from npmrc');
      npmrc = npmrc.replace(/(^|\n)package-lock.*?(\n|$)/g, '');
    }
    if (npmrc) {
      if (npmrc.includes('=${') && !(global.trustLevel === 'high')) {
        logger.info('Discarding .npmrc file with variables');
        npmrc = undefined;
      }
    } else {
      npmrc = undefined;
    }
  }
  const yarnrc =
    (await platform.getFile(upath.join(path.dirname(fileName), '.yarnrc'))) ||
    undefined;

  let lernaDir;
  let lernaPackages;
  let lernaClient;
  let hasFileRefs = false;
  const lernaJson = JSON.parse(
    await platform.getFile(upath.join(path.dirname(fileName), 'lerna.json'))
  );
  if (lernaJson) {
    lernaDir = path.dirname(fileName);
    lernaPackages = lernaJson.packages;
    lernaClient = lernaJson.npmClient || 'npm';
  }

  const depTypes = {
    dependencies: 'dependency',
    devDependencies: 'devDependency',
    optionalDependencies: 'optionalDependency',
    peerDependencies: 'peerDependency',
    engines: 'engine',
  };

  function extractDependency(depType, depName, input) {
    const dep = {};
    if (!validateNpmPackageName(depName).validForOldPackages) {
      dep.skipReason = 'invalid-name';
      return dep;
    }
    if (typeof input !== 'string') {
      dep.skipReason = 'invalid-value';
      return dep;
    }
    dep.currentValue = input.trim();
    if (depType === 'engines') {
      if (depName === 'node') {
        dep.purl = 'pkg:github/nodejs/node';
        dep.versionScheme = 'node';
      } else if (depName === 'yarn') {
        dep.purl = 'pkg:npm/yarn';
        dep.commitMessageTopic = 'Yarn';
      } else if (depName === 'npm') {
        dep.purl = 'pkg:npm/npm';
        dep.commitMessageTopic = 'npm';
      } else {
        dep.skipReason = 'unknown-engines';
      }
      if (!semver.isValid(dep.currentValue)) {
        dep.skipReason = 'unknown-version';
      }
      return dep;
    }
    if (dep.currentValue.startsWith('file:')) {
      dep.skipReason = 'file';
      hasFileRefs = true;
      return dep;
    }
    if (semver.isValid(dep.currentValue)) {
      dep.purl = `pkg:npm/${depName.replace('@', '%40')}`;
      if (dep.currentValue === '*') {
        dep.skipReason = 'any-version';
      }
      if (dep.currentValue === '') {
        dep.skipReason = 'empty';
      }
      return dep;
    }
    const hashSplit = dep.currentValue.split('#');
    if (hashSplit.length !== 2) {
      dep.skipReason = 'unknown-version';
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
      dep.skipReason = 'unknown-version';
      return dep;
    }
    const [githubOwner, githubRepo] = githubRepoSplit;
    const githubValidRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/;
    if (
      !githubOwner.match(githubValidRegex) ||
      !githubRepo.match(githubValidRegex)
    ) {
      dep.skipReason = 'unknown-version';
      return dep;
    }
    if (semver.isVersion(depRefPart)) {
      dep.currentRawValue = dep.currentValue;
      dep.currentValue = depRefPart;
      dep.purl = `pkg:github/${githubOwnerRepo}?ref=tags`;
      dep.pinDigests = false;
    } else if (
      depRefPart.match(/^[0-9a-f]{7}$/) ||
      depRefPart.match(/^[0-9a-f]{40}$/)
    ) {
      dep.currentRawValue = dep.currentValue;
      dep.currentValue = null;
      dep.currentDigest = depRefPart;
      dep.purl = `pkg:github/${githubOwnerRepo}`;
    } else {
      dep.skipReason = 'unversioned-reference';
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
        for (const [depName, val] of Object.entries(packageJson[depType])) {
          const dep = {
            depType,
            depName,
          };
          Object.assign(dep, extractDependency(depType, depName, val));
          if (depName === 'node') {
            // This is a special case for Node.js to group it together with other managers
            dep.commitMessageTopic = 'Node.js';
            dep.major = { enabled: false };
          }
          dep.prettyDepType = depTypes[depType];
          deps.push(dep);
        }
      } catch (err) /* istanbul ignore next */ {
        logger.info(
          { fileName, depType, err, message: err.message },
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
        packageJsonName ||
        packageJsonVersion ||
        npmrc ||
        lernaDir ||
        yarnWorkspacesPackages
      )
    ) {
      logger.debug('Skipping file');
      return null;
    }
  }
  let skipInstalls = config.skipInstalls;
  if (skipInstalls === null) {
    if (hasFileRefs) {
      // https://npm.community/t/npm-i-package-lock-only-changes-lock-file-incorrectly-when-file-references-used-in-dependencies/1412
      // Explanation:
      //  - npm install --package-lock-only is buggy for transitive deps in file: references
      //  - So we set skipInstalls to false if file: refs are found *and* the user hasn't explicitly set the value already
      skipInstalls = false;
    } else {
      skipInstalls = true;
    }
  }
  return {
    deps,
    packageJsonName,
    packageJsonVersion,
    packageJsonType,
    npmrc,
    yarnrc,
    ...lockFiles,
    lernaDir,
    lernaClient,
    lernaPackages,
    skipInstalls,
    yarnWorkspacesPackages,
  };
}

async function postExtract(packageFiles) {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
}
