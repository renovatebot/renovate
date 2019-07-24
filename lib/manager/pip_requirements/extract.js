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

  let indexUrl;
  const extraUrls = [];
  content.split('\n').forEach(line => {
    if (line.startsWith('--index-url ')) {
      indexUrl = line.substring('--index-url '.length).split(' ')[0];
    }
    if (line.startsWith('--extra-index-url ')) {
      const extraUrl = line
        .substring('--extra-index-url '.length)
        .split(' ')[0];
      extraUrls.push(extraUrl);
    }
  });
  let registryUrls = [];
  if (indexUrl) {
    // index url in file takes precedence
    registryUrls.push(indexUrl);
  } else if (config.registryUrls && config.registryUrls.length) {
    // configured registryURls takes next precedence
    registryUrls = registryUrls.concat(config.registryUrls);
  } else if (extraUrls.length) {
    // Use default registry first if extra URLs are present and index URL is not
    registryUrls.push('https://pypi.org/pypi/');
  }
  registryUrls = registryUrls.concat(extraUrls);

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
        managerData: { lineNumber },
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
