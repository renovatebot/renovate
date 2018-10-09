const toml = require('toml')

// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const rangePattern = require('@renovate/pep440/lib/specifier').RANGE_PATTERN;

const specifierPartPattern = `\\s*${rangePattern.replace(
  /\?<\w+>/g,
  '?:'
)}\\s*`;
const specifierPattern = `${specifierPartPattern}(?:,${specifierPartPattern})*`;

module.exports = {
  packagePattern,
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('pipenv.extractDependencies()');
  const packageRegex = new RegExp(`^${packagePattern}$`, 'g');
  const specifierRegex = new RegExp(`^${specifierPattern}$`, 'g');
  const deps = Object.entries(toml.parse(content).packages)
    .map(([depName, currentValue], lineNumber) => {
      packageRegex.lastIndex = 0;
      specifierRegex.lastIndex = 0;
      const packageMatches = packageRegex.exec(depName);
      const specifierMatches = specifierRegex.exec(currentValue);
      if (!packageMatches || !specifierMatches) {
        logger.debug('bad package name or bad specifier' + depName + ' ' + currentValue);
        return null;
      }
      const dep = {
        depName,
        currentValue,
        lineNumber,
        purl: 'pkg:pypi/' + depName,
        versionScheme: 'pep440',
      };
      logger.debug('Found a dep: ' + dep);
      // TODO: Support other python indexes
      return dep;
    })
    .filter(Boolean)
  if (!deps.length) {
    return null;
  }
  return { deps };
}

