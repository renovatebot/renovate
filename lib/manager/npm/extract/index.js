const path = require('path');
const upath = require('upath');
const { getLockedVersions } = require('./lock-files');
const { detectMonorepos } = require('./monorepo');

module.exports = {
  extractDependencies,
  postExtract,
};

async function extractDependencies(content, packageFile) {
  const deps = [];
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ packageFile }, 'Invalid JSON');
    return null;
  }
  const packageJsonName = packageJson.name;
  const packageJsonVersion = packageJson.version;
  const yarnWorkspacesPackages = packageJson.workspaces;

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

  let npmrc = await platform.getFile(
    upath.join(path.dirname(packageFile), '.npmrc')
  );
  if (!npmrc) {
    npmrc = undefined;
  }

  let lernaDir;
  let lernaPackages;
  let lernaClient;
  const lernaJson = JSON.parse(
    await platform.getFile(upath.join(path.dirname(packageFile), 'lerna.json'))
  );
  if (lernaJson) {
    lernaDir = path.dirname(packageFile);
    lernaPackages = lernaJson.packages;
    lernaClient = lernaJson.npmClient;
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
          deps.push({
            depName,
            depType,
            currentVersion: version.trim().replace(/^=/, ''),
          });
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
  if (!(deps.length || lernaDir || yarnWorkspacesPackages)) {
    return null;
  }
  return {
    deps,
    packageJsonName,
    packageJsonVersion,
    npmrc,
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
