const minimatch = require('minimatch');
const path = require('path');
const upath = require('upath');

module.exports = {
  checkMonorepos,
};

async function checkMonorepos(config) {
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
    const basePath = upath.join(workspaceDir, workspace);
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
  let lernaJson;
  try {
    lernaJson = JSON.parse(await platform.getFile('lerna.json'));
  } catch (err) {
    // do nothing
  }
  if (lernaJson && lernaJson.packages) {
    logger.debug({ lernaJson }, 'Found lerna config');
    for (const packageGlob of lernaJson.packages) {
      for (const packageFile of config.packageFiles) {
        if (minimatch(path.dirname(packageFile.packageFile), packageGlob)) {
          const depName = packageFile.content.name;
          if (!monorepoPackages.includes(depName)) {
            monorepoPackages.push(depName);
          }
          packageFile.lerna = true;
        }
      }
    }
  }
  return { ...config, monorepoPackages };
}
