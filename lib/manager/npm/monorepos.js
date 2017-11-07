const minimatch = require('minimatch');
const path = require('path');
const platform = require('../../platform');

module.exports = {
  checkMonorepos,
};

async function checkMonorepos(config) {
  const { logger } = config;
  const monorepoPackages = [];
  let workspaceDir;
  // yarn workspaces
  let workspaces = [];
  for (const packageFile of config.packageFiles) {
    if (
      packageFile.packageFile &&
      packageFile.packageFile.endsWith('package.json') &&
      packageFile.content.workspaces
    ) {
      workspaceDir = path.dirname(packageFile.packageFile);
      logger.info(`workspaceDir=${config.workspaceDir}`);
      ({ workspaces } = packageFile.content);
    }
  }
  if (workspaces.length) {
    logger.debug({ workspaces }, 'Found yarn workspaces');
  }
  for (const workspace of workspaces) {
    const basePath = path.join(workspaceDir, workspace);
    logger.info(`basePath=${basePath}`);
    for (const packageFile of config.packageFiles) {
      if (minimatch(path.dirname(packageFile.packageFile), basePath)) {
        logger.info(`Matched ${packageFile.packageFile}`);
        const depName = packageFile.content.name;
        monorepoPackages.push(depName);
        packageFile.workspaceDir = workspaceDir;
      }
    }
  }
  // lerna
  const lernaJson = await platform.getFileJson('lerna.json');
  if (lernaJson && lernaJson.packages) {
    logger.debug({ lernaJson }, 'Found lerna config');
    for (const packageGlob of lernaJson.packages) {
      for (const packageFile of config.packageFiles) {
        if (minimatch(path.dirname(packageFile.packageFile), packageGlob)) {
          const depName = packageFile.content.name;
          if (!monorepoPackages.includes(depName)) {
            monorepoPackages.push(depName);
          }
        }
      }
    }
  }
  return { ...config, monorepoPackages, workspaceDir };
}
