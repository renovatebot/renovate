const path = require('path');

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
  const packageFiles = [];
  for (let packageFile of allPackageFiles) {
    packageFile =
      typeof packageFile === 'string' ? { packageFile } : packageFile;
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
      } else {
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
        }
      }
      if (!config.ignoreNpmrcFile) {
        packageFile.npmrc = await platform.getFile(
          path.join(path.dirname(packageFile.packageFile), '.npmrc')
        );
      }
      if (!packageFile.npmrc) {
        delete packageFile.npmrc;
      }
      packageFile.yarnrc = await platform.getFile(
        path.join(path.dirname(packageFile.packageFile), '.yarnrc')
      );
      if (!packageFile.yarnrc) {
        delete packageFile.yarnrc;
      }
      if (packageFile.content) {
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
        const yarnLockFileName = path.join(
          path.dirname(packageFile.packageFile),
          'yarn.lock'
        );
        packageFile.yarnLock = await platform.getFile(yarnLockFileName);
        if (packageFile.yarnLock) {
          logger.debug(
            { packageFile: packageFile.packageFile },
            'Found yarn.lock'
          );
        }
        const packageLockFileName = path.join(
          path.dirname(packageFile.packageFile),
          'package-lock.json'
        );
        packageFile.packageLock = await platform.getFile(packageLockFileName);
        if (packageFile.packageLock) {
          logger.debug(
            { packageFile: packageFile.packageFile },
            'Found package-lock.json'
          );
        }
      } else {
        continue; // eslint-disable-line
      }
    } else if (packageFile.packageFile.endsWith('package.js')) {
      // meteor
      packageFile = mergeChildConfig(config.meteor, packageFile);
    } else if (packageFile.packageFile.endsWith('Dockerfile')) {
      logger.debug('Resolving Dockerfile');
      packageFile = await dockerResolve.resolvePackageFile(config, packageFile);
    }
    if (packageFile) {
      packageFiles.push(packageFile);
    }
  }
  return checkMonorepos({ ...config, packageFiles });
}
