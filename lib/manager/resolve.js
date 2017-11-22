const path = require('path');
const upath = require('upath');

const { migrateAndValidate } = require('../config/migrate-validate');
const presets = require('../config/presets');

const manager = require('./index');
const dockerResolve = require('../manager/docker/resolve');
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
        config.warnings.push({
          depName: packageFile.packageFile,
          message: 'Cannot parse package.json (invalid JSON)',
        });
        return null;
      }
      if (!config.ignoreNpmrcFile) {
        packageFile.npmrc = await platform.getFile(
          upath.join(path.dirname(packageFile.packageFile), '.npmrc')
        );
      }
      if (!packageFile.npmrc) {
        delete packageFile.npmrc;
      }
      packageFile.yarnrc = await platform.getFile(
        upath.join(path.dirname(packageFile.packageFile), '.yarnrc')
      );
      if (!packageFile.yarnrc) {
        delete packageFile.yarnrc;
      }
      // hoist renovate config if exists
      if (packageFile.content.renovate) {
        logger.debug(
          {
            packageFile: packageFile.packageFile,
            config: packageFile.content.renovate,
          },
          `Found package.json renovate config`
        );
        const migratedConfig = migrateAndValidate(
          config,
          packageFile.content.renovate
        );
        logger.debug(
          { config: migratedConfig },
          'package.json migrated config'
        );
        const resolvedConfig = await presets.resolveConfigPresets(
          migratedConfig
        );
        logger.debug(
          { config: resolvedConfig },
          'package.json resolved config'
        );
        Object.assign(packageFile, resolvedConfig);
        delete packageFile.content.renovate;
      } else {
        logger.debug(
          { packageFile: packageFile.packageFile },
          `No renovate config`
        );
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
      return packageFile;
    } else if (packageFile.packageFile.endsWith('package.js')) {
      // meteor
      return mergeChildConfig(config.meteor, packageFile);
    } else if (packageFile.packageFile.endsWith('Dockerfile')) {
      logger.debug('Resolving Dockerfile');
      return dockerResolve.resolvePackageFile(config, packageFile);
    }
    return null;
  }
  logger.debug('queue');
  const queue = allPackageFiles.map(p => resolvePackageFile(p));
  const packageFiles = (await Promise.all(queue)).filter(p => p !== null);
  return checkMonorepos({ ...config, packageFiles });
}
