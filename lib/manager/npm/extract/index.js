const path = require('path');
const upath = require('upath');
const { getLockedVersions } = require('./locked-versions');
const { detectMonorepos } = require('./monorepo');
const { mightBeABrowserLibrary } = require('./type');
const semver = require('../../../versioning/semver');

module.exports = {
  extractDependencies,
  postExtract,
};

async function extractDependencies(content, packageFile, config) {
  logger.debug(`npm.extractDependencies(${packageFile})`);
  logger.trace({ content });
  const deps = [];
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ packageFile }, 'Invalid JSON');
    return null;
  }
  if (packageFile !== 'package.json' && packageJson.renovate) {
    const error = new Error('config-validation');
    error.configFile = packageFile;
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
    const filePath = upath.join(path.dirname(packageFile), val);
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
      upath.join(path.dirname(packageFile), '.npmrc')
    );
    if (npmrc) {
      if (
        npmrc.includes('=${') &&
        !(config.global && config.global.exposeEnv)
      ) {
        logger.info('Discarding .npmrc file with variables');
        npmrc = undefined;
      }
    } else {
      npmrc = undefined;
    }
  }
  const yarnrc =
    (await platform.getFile(
      upath.join(path.dirname(packageFile), '.yarnrc')
    )) || undefined;

  let lernaDir;
  let lernaPackages;
  let lernaClient;
  const lernaJson = JSON.parse(
    await platform.getFile(upath.join(path.dirname(packageFile), 'lerna.json'))
  );
  if (lernaJson) {
    lernaDir = path.dirname(packageFile);
    lernaPackages = lernaJson.packages;
    lernaClient = lernaJson.npmClient || 'npm';
  }

  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
    'engines',
  ];
  for (const depType of depTypes) {
    if (packageJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(packageJson[depType])) {
          const dep = {
            depType,
            depName,
          };
          // TODO: do we need to remove the equals?
          dep.currentVersion = version.trim().replace(/^=/, '');
          if (dep.currentVersion.startsWith('file:')) {
            dep.skipReason = 'file';
          } else if (depType === 'engines' && depName === 'node') {
            dep.purl = 'pkg:github/nodejs/node';
          } else if (depType === 'engines' && depName === 'yarn') {
            dep.purl = 'pkg:github/yarnpkg/yarn';
            dep.commitMessageTopic = 'Yarn';
          } else if (semver.isValid(dep.currentVersion)) {
            dep.purl = `pkg:npm/${depName.replace('@', '%40')}`;
            if (dep.currentVersion === '*') {
              dep.skipReason = 'any-version';
            }
          } else {
            dep.skipReason = 'unknown-version';
          }
          if (depName === 'node') {
            // This is a special case for Node.js to group it together with other managers
            dep.commitMessageTopic = 'Node.js';
          }
          deps.push(dep);
        }
      } catch (err) /* istanbul ignore next */ {
        logger.info(
          { packageFile, depType, err, message: err.message },
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
    yarnWorkspacesPackages,
  };
}

async function postExtract(packageFiles) {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
}
