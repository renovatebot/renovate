// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
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

  let registryUrls;
  content.split('\n').forEach(line => {
    if (line.startsWith('--index-url ')) {
      const registryUrl = line.substring('--index-url '.length);
      registryUrls = [registryUrl];
    }
  });

  const regex = new RegExp(
    `^(${packagePattern})${extrasPattern}(${specifierPattern})$`,
    'g'
  );
  const deps = content
    .split('\n')
    .map((rawline, lineNumber) => {
      let dep = {};
      const [line, comment] = rawline.split('#').map(part => part.trim());
      if (comment && comment.match(/^(renovate|pyup):/)) {
        const command = comment
          .split('#')[0]
          .split(':')[1]
          .trim();
        if (command === 'ignore') {
          dep.skipReason = 'ignored';
        } else {
          logger.info('Unknown pip_requirements command: ' + command);
        }
      }
      regex.lastIndex = 0;
      const matches = regex.exec(line);
      if (!matches) {
        return null;
      }
      const [, depName, currentValue] = matches;
      dep = {
        ...dep,
        depName,
        currentValue,
        lineNumber,
        purl: 'pkg:pypi/' + depName,
        versionScheme: 'pep440',
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
