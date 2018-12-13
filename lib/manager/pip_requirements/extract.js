// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
const rangePattern = require('@renovate/pep440/lib/specifier').RANGE_PATTERN;

const { isSkipComment } = require('../../util/ignore');

const specifierPartPattern = `\\s*${rangePattern.replace(/\?<\w+>/g, '?:')}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;

module.exports = {
  dependencyPattern,
  packagePattern,
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('pip_requirements.extractPackageFile()');

  let registryUrls;
  content.split('\n').forEach(line => {
    if (line.startsWith('--index-url ')) {
      const registryUrl = line.substring('--index-url '.length);
      registryUrls = [registryUrl];
    }
  });

  const regex = new RegExp(`^${dependencyPattern}$`, 'g');
  const deps = content
    .split('\n')
    .map((rawline, lineNumber) => {
      let dep = {};
      const [line, comment] = rawline.split('#').map(part => part.trim());
      if (isSkipComment(comment)) {
        dep.skipReason = 'ignored';
      }
      regex.lastIndex = 0;
      const matches = regex.exec(line);
      if (!matches) {
        return null;
      }
      const [, depName, , currentValue] = matches;
      dep = {
        ...dep,
        depName,
        currentValue,
        lineNumber,
        purl: 'pkg:pypi/' + depName,
      };
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}
