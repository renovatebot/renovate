const minimatch = require('minimatch');
const path = require('path');
const upath = require('upath');

module.exports = {
  detectMonorepos,
};

function matchesAnyPattern(val, patterns) {
  return patterns.some(pattern => minimatch(val, pattern));
}

function detectMonorepos(packageFiles) {
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const {
      packageFile,
      npmLock,
      yarnLock,
      lernaDir,
      lernaClient,
      lernaPackages,
      yarnWorkspacesPackages,
    } = p;
    const basePath = path.dirname(packageFile);
    const packages =
      lernaClient === 'yarn' && yarnWorkspacesPackages
        ? yarnWorkspacesPackages
        : lernaPackages;
    if (packages && packages.length) {
      logger.debug(
        { packageFile },
        'Found monorepo packages with base path ' + basePath
      );
      const subPackagePatterns = packages.map(pattern =>
        upath.join(basePath, pattern)
      );
      const subPackages = packageFiles.filter(sp =>
        matchesAnyPattern(path.dirname(sp.packageFile), subPackagePatterns)
      );
      const subPackageNames = subPackages
        .map(sp => sp.packageJsonName)
        .filter(Boolean);
      // add all names to main package.json
      packageFile.monorepoPackages = subPackageNames;
      for (const subPackage of subPackages) {
        subPackage.monorepoPackages = subPackageNames.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.lernaDir = lernaDir;
        subPackage.lernaClient = lernaClient;
        subPackage.yarnLock = subPackage.yarnLock || yarnLock;
        subPackage.npmLock = subPackage.npmLock || npmLock;
      }
    }
  }
}
