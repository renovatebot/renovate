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
  logger.debug('pip_requirements.extractDependencies()');

  const regex = new RegExp(`^(${packagePattern})(${specifierPattern})$`, 'g');
  const deps = content
    .split('\n')
    .map((line, lineNumber) => {
      regex.lastIndex = 0;
      const matches = regex.exec(line);
      if (!matches) {
        return null;
      }
      const [, depName, currentValue] = matches;
      return {
        depName,
        currentValue,
        lineNumber,
        purl: 'pkg:pypi/' + depName,
        versionScheme: 'pep440',
      };
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}
