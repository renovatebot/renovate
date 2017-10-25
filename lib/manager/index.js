const docker = require('./docker/package');
const npm = require('./npm/package');

const dockerDetect = require('./docker/detect');
const meteorDetect = require('./meteor/detect');
const npmDetect = require('./npm/detect');

module.exports = {
  detectPackageFiles,
  getPackageUpdates,
};

async function detectPackageFiles(input) {
  const config = { ...input };
  const { logger } = config;
  const fileList = (await config.api.getFileList()).filter(
    file => !config.ignorePaths.some(ignorePath => file.includes(ignorePath))
  );
  logger.debug({ config }, 'detectPackageFiles');
  config.types = {};
  const packageJsonFiles = await npmDetect.detectPackageFiles(config, fileList);
  if (packageJsonFiles.length) {
    logger.info({ packageJsonFiles }, 'Found package.json files');
    config.packageFiles = config.packageFiles.concat(packageJsonFiles);
    config.types.npm = true;
  }
  const meteorFiles = await meteorDetect.detectPackageFiles(config, fileList);
  if (meteorFiles.length) {
    logger.info({ packageJsonFiles }, 'Found meteor files');
    config.packageFiles = config.packageFiles.concat(meteorFiles);
    config.types.meteor = true;
  }
  const dockerFiles = await dockerDetect.detectPackageFiles(config, fileList);
  if (dockerFiles.length) {
    logger.info({ dockerFiles }, 'Found Dockerfiles');
    config.packageFiles = config.packageFiles.concat(dockerFiles);
    config.types.docker = true;
  }
  return config;
}

async function getPackageUpdates(config) {
  if (config.packageFile.endsWith('Dockerfile')) {
    return docker.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('package.json')) {
    return npm.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('package.js')) {
    return npm.getPackageUpdates(config);
  }
  config.logger.info(`Cannot find manager for ${config.packageFile}`);
  throw new Error('Unsupported package manager');
}
