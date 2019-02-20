const { isVersion } = require('../../versioning/semver');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('nuget.extractPackageFile()');
  const deps = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(
      /<PackageReference.*Include\s*=\s*"([^"]+)".*Version\s*=\s*"([^"]+)"/
    );
    if (match) {
      const depName = match[1];
      const currentValue = match[2];
      const dep = {
        depType: 'nuget',
        depName,
        currentValue,
        lineNumber,
        purl: 'pkg:nuget/' + depName,
      };
      if (!isVersion(currentValue)) {
        dep.skipReason = 'not-version';
      }
      deps.push(dep);
    }
    lineNumber += 1;
  }
  return { deps };
}
