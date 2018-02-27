const path = require('path');
const upath = require('upath');
const minimatch = require('minimatch');

const manager = require('./index');
const dockerResolve = require('../manager/docker/resolve');
const nodeResolve = require('../manager/node/resolve');
const bazelResolve = require('../manager/bazel/resolve');
const { mergeChildConfig } = require('../config');
const { checkMonorepos } = require('../manager/npm/monorepos');

module.exports = {
  resolvePackageFiles,
};

async function resolvePackageFiles(config) {
  logger.trace({ config }, 'resolvePackageFiles()');
  const allPackageFiles = config.packageFiles.length
    ? config.packageFiles
    : await manager.detectPackageFiles(config);
  logger.debug({ allPackageFiles }, 'allPackageFiles');
  const fileList = await platform.getFileList();
  async function resolvePackageFile(p) {
    const packageFile = typeof p === 'string' ? { packageFile: p } : p;
    if (packageFile.packageFile.endsWith('package.json')) {
      logger.debug(`Resolving packageFile ${JSON.stringify(packageFile)}`);
      const pFileRaw = await platform.getFile(packageFile.packageFile);
      if (!pFileRaw) {
        logger.info(
          { packageFile: packageFile.packageFile },
          'Cannot find package.json'
        );
        config.errors.push({
          depName: packageFile.packageFile,
          message: 'Cannot find package.json',
        });
        return null;
      }
      try {
        packageFile.content = JSON.parse(pFileRaw);
      } catch (err) {
        logger.info(
          { packageFile: packageFile.packageFile },
          'Cannot parse package.json'
        );
        if (config.repoIsOnboarded) {
          const error = new Error('config-validation');
          error.configFile = packageFile.packageFile;
          error.validationError = 'Cannot parse package.json';
          error.validationMessage =
            'This package.json contains invalid JSON and cannot be parsed. Please fix it, or add it to your "ignorePaths" array in your renovate config so that Renovate can continue.';
          throw error;
        }
        config.errors.push({
          depName: packageFile.packageFile,
          message:
            "Cannot parse package.json (invalid JSON). Please fix the contents or add the file/path to the `ignorePaths` array in Renovate's config",
        });
        return null;
      }
      if (!config.ignoreNpmrcFile) {
        packageFile.npmrc = await platform.getFile(
          upath.join(path.dirname(packageFile.packageFile), '.npmrc')
        );
      }
      if (packageFile.npmrc) {
        logger.info('Found .npmrc');
        if (
          packageFile.npmrc.match(/\${NPM_TOKEN}/) &&
          !config.global.exposeEnv
        ) {
          logger.info('Stripping NPM_TOKEN from .npmrc');
          packageFile.npmrc = packageFile.npmrc
            .replace(/(^|\n).*?\${NPM_TOKEN}.*?(\n|$)/g, '')
            .trim();
          if (packageFile.npmrc === '') {
            logger.info('Removing empty .npmrc');
            delete packageFile.npmrc;
          }
        }
      } else {
        delete packageFile.npmrc;
      }
      packageFile.yarnrc = await platform.getFile(
        upath.join(path.dirname(packageFile.packageFile), '.yarnrc')
      );
      if (packageFile.yarnrc) {
        logger.info('Found .yarnrc');
      } else {
        delete packageFile.yarnrc;
      }
      // Detect if lock files are used
      const yarnLockFileName = upath.join(
        path.dirname(packageFile.packageFile),
        'yarn.lock'
      );
      if (fileList.includes(yarnLockFileName)) {
        logger.debug(
          { packageFile: packageFile.packageFile },
          'Found yarn.lock'
        );
        packageFile.yarnLock = yarnLockFileName;
      }
      const packageLockFileName = upath.join(
        path.dirname(packageFile.packageFile),
        'package-lock.json'
      );
      if (fileList.includes(packageLockFileName)) {
        logger.debug(
          { packageFile: packageFile.packageFile },
          'Found package-lock.json'
        );
        packageFile.packageLock = packageLockFileName;
      }
      const shrinkwrapFileName = upath.join(
        path.dirname(packageFile.packageFile),
        'shrinkwrap.yaml'
      );
      if (fileList.includes(shrinkwrapFileName)) {
        logger.debug(
          { packageFile: packageFile.packageFile },
          'Found shrinkwrap.yaml'
        );
        packageFile.shrinkwrapYaml = shrinkwrapFileName;
      }
      packageFile.currentPackageJsonVersion = packageFile.content.version;
      return mergeChildConfig(config.npm, packageFile);
    } else if (packageFile.packageFile.endsWith('package.js')) {
      // meteor
      return mergeChildConfig(config.meteor, packageFile);
    } else if (packageFile.packageFile.endsWith('Dockerfile')) {
      logger.debug('Resolving Dockerfile');
      return dockerResolve.resolvePackageFile(config, packageFile);
    } else if (packageFile.packageFile.endsWith('.travis.yml')) {
      logger.debug('Resolving .travis.yml');
      return nodeResolve.resolvePackageFile(config, packageFile);
    } else if (packageFile.packageFile.endsWith('WORKSPACE')) {
      logger.debug('Resolving WORKSPACE');
      return bazelResolve.resolvePackageFile(config, packageFile);
    }
    return null;
  }
  logger.debug('queue');
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
