const { isVersion } = require('../../versioning/semver');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('mix.extractPackageFile()');
  const deps = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(
      /{:(\w+),\s*([^:"]+)?:?\s*"([^"]+)"(,\s*organization:\s*"(.*)")?}/
    );
    if (match) {
      const depName = match[1];
      const datasource = match[2];
      const currentValue = match[3];
      const organization = match[5] ? match[5] : null;
      const dep = {
        depType: 'hex',
        depName,
        currentValue,
        lineNumber,
        organization,
      };
      if (datasource) {
        dep.datasource = datasource;
      } else {
        dep.datasource = 'hex';
      }
      if (!isVersion(currentValue)) {
        dep.skipReason = 'not-version';
      }
      deps.push(dep);
    }
    lineNumber += 1;
  }
  return { deps };
}
