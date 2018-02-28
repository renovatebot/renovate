const minimatch = require('minimatch');

const manager = require('./index');
const dockerResolve = require('../manager/docker/resolve');
const meteorResolve = require('../manager/meteor/resolve');
const nodeResolve = require('../manager/node/resolve');
const bazelResolve = require('../manager/bazel/resolve');
const npmResolve = require('../manager/npm/resolve');
const { mergeChildConfig } = require('../config');
const { checkMonorepos } = require('../manager/npm/monorepos');

module.exports = {
  resolvePackageFiles,
};

async function resolvePackageFiles(config) {
  logger.debug('manager.resolvePackageFiles()');
  logger.trace({ config });
  const allPackageFiles =
    config.packageFiles && config.packageFiles.length
      ? config.packageFiles
      : await manager.detectPackageFiles(config);
  logger.debug({ allPackageFiles }, 'allPackageFiles');
  const managerFileMappings = {
    '.travis.yml': 'node',
    Dockerfile: 'docker',
    WORKSPACE: 'bazel',
    'package.js': 'meteor',
    'package.json': 'npm',
  };
  function resolvePackageFile(p) {
    const packageFile = typeof p === 'string' ? { packageFile: p } : p;
    const fileName = packageFile.packageFile.split('/').pop();
    packageFile.manager = packageFile.manager || managerFileMappings[fileName];
    if (!packageFile.manager) {
      // Config error
      const error = new Error('config-validation');
      error.configFile = packageFile.packageFile;
      error.validationError = 'Unknown file type';
      error.validationMessage =
        'Please correct the file name in your packageFiles array';
      throw error;
    }
    if (packageFile.manager === 'npm') {
      return npmResolve.resolvePackageFile(config, packageFile);
    } else if (packageFile.manager === 'meteor') {
      return meteorResolve.resolvePackageFile(config, packageFile);
    } else if (packageFile.manager === 'docker') {
      return dockerResolve.resolvePackageFile(config, packageFile);
    } else if (packageFile.manager === 'node') {
      return nodeResolve.resolvePackageFile(config, packageFile);
    } else if (packageFile.manager === 'bazel') {
      return bazelResolve.resolvePackageFile(config, packageFile);
    }
    // istanbul ignore next
    throw new Error('unknown manager');
  }
  // TODO: throttle how many we resolve in parallel
  const queue = allPackageFiles.map(p => resolvePackageFile(p));
  let packageFiles = (await Promise.all(queue)).filter(p => p !== null);
  logger.debug('Checking against path rules');
  packageFiles = packageFiles.map(pf => {
    let packageFile = { ...pf };
    for (const pathRule of config.pathRules) {
      /* eslint-disable no-loop-func */
      if (
        pathRule.paths.some(
          rulePath =>
            packageFile.packageFile.includes(rulePath) ||
            minimatch(packageFile.packageFile, rulePath)
        )
      ) {
        logger.debug({ pathRule, packageFile }, 'Matched pathRule');
        packageFile = mergeChildConfig(packageFile, pathRule);
        delete packageFile.paths;
      }
      /* eslint-enable */
    }
    return packageFile;
  });

  platform.ensureIssueClosing('Action Required: Fix Renovate Configuration');
  return checkMonorepos({ ...config, packageFiles });
}
