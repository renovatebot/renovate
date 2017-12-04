const minimatch = require('minimatch');
const path = require('path');
const upath = require('upath');

module.exports = {
  checkMonorepos,
};

async function checkMonorepos(config) {
  const monorepoPackages = [];
  logger.debug('checkMonorepos()');
  logger.trace({ config });
  // yarn workspaces
  for (const packageFile of config.packageFiles) {
    if (
      packageFile.packageFile &&
      packageFile.packageFile.endsWith('package.json') &&
      packageFile.content.workspaces
    ) {
      const workspaceDir = path.dirname(packageFile.packageFile);
      const { workspaces } = packageFile.content;
      if (workspaces.length) {
        logger.info(
          { packageFile: packageFile.packageFile, workspaces },
          'Found yarn workspaces'
        );
        for (const workspace of workspaces) {
          const basePath = upath.join(workspaceDir, workspace);
          logger.debug(`basePath=${basePath}`);
          for (const innerPackageFile of config.packageFiles) {
            if (
              minimatch(path.dirname(innerPackageFile.packageFile), basePath)
            ) {
              logger.debug(`Matched ${innerPackageFile.packageFile}`);
              const depName = innerPackageFile.content.name;
              monorepoPackages.push(depName);
              innerPackageFile.workspaceDir = workspaceDir;
            }
          }
        }
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
