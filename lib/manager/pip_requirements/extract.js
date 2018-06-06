const XRegExp = require('xregexp');
// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const versionPattern = require('@renovate/pep440/lib/version').VERSION_PATTERN;

module.exports = {
  packagePattern,
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('pip_requirements.extractDependencies()');
  // TODO: for now we only support package==version
  // future support for more complex ranges could be added later
  const regex = new XRegExp(`^(${packagePattern})(==${versionPattern})$`, 'g');
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
