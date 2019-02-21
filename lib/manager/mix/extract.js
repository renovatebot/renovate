const { isValid } = require('../../versioning/npm');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('mix.extractPackageFile()');
  const deps = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const pakageMatch = line.match(/{:(\w+),\s*([^:"]+)?:?\s*"([^"]+)".*}/);
    if (pakageMatch) {
      const depName = pakageMatch[1];
      const datasource = pakageMatch[2];
      const currentValue = pakageMatch[3];

      const dep = {
        depName,
        currentValue,
        lineNumber,
      };

      if (datasource) {
        dep.datasource = datasource;
        dep.depType = datasource;
        dep.lookupName = currentValue;
        dep.currentValue = null;
      } else {
        dep.datasource = 'hex';
        dep.depType = 'hex';
        dep.currentValue = currentValue;
      }

      const organizationMatch = line.match(/.*organization:\s"(\w+)"/);
      if (organizationMatch) {
        dep.organization = organizationMatch[1];
      }

      if (!isValid(currentValue)) {
        dep.skipReason = 'unsupported-version';
      }
      deps.push(dep);
    }
    lineNumber += 1;
  }
  return { deps };
}
