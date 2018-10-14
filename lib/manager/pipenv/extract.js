const toml = require('toml');

// based on https://www.python.org/dev/peps/pep-0508/#names
const packageRegex = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i;
const rangePattern = require('@renovate/pep440/lib/specifier').RANGE_PATTERN;

const specifierPartPattern = `\\s*${rangePattern.replace(
  /\?<\w+>/g,
  '?:'
)}\\s*`;
const specifierPattern = `${specifierPartPattern}(?:,${specifierPartPattern})*`;

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('pipenv.extractDependencies()');
  const specifierRegex = new RegExp(`^${specifierPattern}$`);
  let pipfileToml;
  try {
    pipfileToml = toml.parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Pipfile');
    return null;
  }
  const deps = Object.entries(pipfileToml.packages)
    .map(x => {
      const [depName, currentValue] = x;
      const packageMatches = packageRegex.exec(depName);
      const specifierMatches = specifierRegex.exec(currentValue);
      if (!packageMatches) {
        logger.debug(
          `Skipping dependency with malformed package name "${depName}".`
        );
        return null;
      }
      if (!specifierMatches) {
        logger.debug(
          `Skipping dependency with malformed version specifier "${currentValue}".`
        );
        return null;
      }
      const dep = {
        depName,
        currentValue,
        purl: 'pkg:pypi/' + depName,
        versionScheme: 'pep440',
      };
      // TODO: Support other python indexes
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}
