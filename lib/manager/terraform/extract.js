const { isValid, isVersion } = require('../../versioning/semver');

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('terraform.extractDependencies()');
  logger.trace({ content });
  if (!content.includes('module "')) {
    return null;
  }
  const deps = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const module = line.match(/^module\s+"([^"]+)"\s+{\s*$/);
      if (module) {
        logger.trace(`Matched module on line ${lineNumber}`);
        const dep = {
          moduleName: module[1],
        };
        do {
          lineNumber += 1;
          line = lines[lineNumber];
          const kvMatch = line.match(/^\s*([^\s]+)\s+=\s+"([^"]+)"\s*$/);
          if (kvMatch) {
            const [, key, value] = kvMatch;
            if (key === 'version') {
              dep.currentValue = value;
              dep.versionLine = lineNumber;
            } else if (key === 'source') {
              dep.source = value;
              dep.sourceLine = lineNumber;
            }
          }
        } while (line.trim() !== '}');
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error(
      { err, message: err.message },
      'Error extracting buildkite plugins'
    );
  }
  deps.forEach(dep => {
    const githubRefMatch =
      dep.source &&
      dep.source.match(/github.com(\/|:)([^/]+\/[a-z0-9-]+).*\?ref=(.*)$/);
    /* eslint-disable no-param-reassign */
    if (githubRefMatch) {
      dep.depType = 'github';
      dep.depName = 'github.com/' + githubRefMatch[2];
      dep.depNameShort = githubRefMatch[2];
      dep.currentValue = githubRefMatch[3];
      dep.purl = 'pkg:github/' + githubRefMatch[2];
      dep.lineNumber = dep.sourceLine;
      if (isVersion(dep.currentValue)) {
        dep.versionScheme = 'semver';
      } else {
        dep.skipReason = 'unsupported-version';
      }
    } else {
      const moduleParts = dep.source.split('//')[0].split('/');
      if (moduleParts.length === 3) {
        dep.depType = 'terraform';
        dep.depName = moduleParts.join('/');
        dep.depNameShort = dep.depName;
        dep.lineNumber = dep.versionLine;
        dep.purl = 'pkg:terraform/' + dep.depName;
      } else if (moduleParts.length === 4) {
        dep.depType = 'terraform';
        dep.registry = moduleParts.unshift();
        dep.depName = moduleParts.join('/');
        dep.depNameShort = dep.depName;
        dep.lineNumber = dep.versionLine;
        dep.purl = 'pkg:terraform/' + dep.depName + '?registry=' + dep.registry;
      }
      if (dep.lineNumber) {
        if (isValid(dep.currentValue)) {
          dep.versionScheme = 'semver';
        } else {
          dep.skipReason = 'unsupported-version';
        }
      } else {
        dep.skipReason = 'no-version';
      }
    }

    delete dep.sourceLine;
    delete dep.versionLine;
    /* eslint-enable no-param-reassign */
  });
  return deps.length ? { deps } : null;
}
