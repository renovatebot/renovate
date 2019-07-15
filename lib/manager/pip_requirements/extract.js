// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
const rangePattern = require('@renovate/pep440/lib/specifier').RANGE_PATTERN;

const { logger } = require('../../logger');
const { isSkipComment } = require('../../util/ignore');

const specifierPartPattern = `\\s*${rangePattern.replace(/\?<\w+>/g, '?:')}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;
const { isValid, isSingleVersion } = require('../../versioning/pep440');

module.exports = {
  dependencyPattern,
  packagePattern,
  extractPackageFile,
};

function extractPackageFile(content, _, config) {
  logger.trace('pip_requirements.extractPackageFile()');

  const registryUrls = [];
  let has_index_url = false;
  content.split('\n').forEach(line => {
    if (line.startsWith('--index-url ')) {
      const registryUrl = line.substring('--index-url '.length).split(' ')[0];
      registryUrls.push(registryUrl);
      has_index_url = true;
    }
    if (line.startsWith('--extra-index-url ')) {
      const registryUrl = line
        .substring('--extra-index-url '.length)
        .split(' ')[0];
      registryUrls.push(registryUrl);
    }
  });
  if (registryUrls.length > 0 && !has_index_url) {
    if (config.registryUrls) {
      registryUrls.push(...config.registryUrls);
    } else {
      registryUrls.push('https://pypi.org/pypi/');
    }
  }

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
        datasource: 'pypi',
      };
      if (
        isValid(currentValue) &&
        isSingleVersion(currentValue) &&
        currentValue.startsWith('==')
      ) {
        dep.fromVersion = currentValue.replace(/^==/, '');
      }
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  const res = { deps };
  if (registryUrls.length > 0) {
    res.registryUrls = registryUrls;
  }
  return res;
}
