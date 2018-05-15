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
    const packages = yarnWorkspacesPackages || lernaPackages;
    if (packages && packages.length) {
      logger.debug(
        { packageFile },
        'Found monorepo packages with base path ' + basePath
      );
      const subPackagePatterns = packages.map(pattern =>
        upath.join(basePath, pattern)
      );
      const internalPackageFiles = packageFiles.filter(sp =>
        matchesAnyPattern(path.dirname(sp.packageFile), subPackagePatterns)
      );
      // add all names to main package.json
      packageFile.internalPackages = internalPackageFiles
        .map(sp => sp.packageJsonName)
        .filter(Boolean);
      for (const subPackage of internalPackageFiles) {
        subPackage.internalPackages = packageFile.internalPackages.filter(
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
