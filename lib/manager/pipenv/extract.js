const toml = require('toml');
const is = require('@sindresorhus/is').default;

// based on https://www.python.org/dev/peps/pep-0508/#names
const packageRegex = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i;
const rangePattern = require('@renovate/pep440/lib/specifier').RANGE_PATTERN;
const { logger } = require('../../logger');

const specifierPartPattern = `\\s*${rangePattern.replace(
  /\?<\w+>/g,
  '?:'
)}\\s*`;
const specifierPattern = `${specifierPartPattern}(?:,${specifierPartPattern})*`;

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('pipenv.extractPackageFile()');
  let pipfile;
  try {
    pipfile = toml.parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Pipfile');
    return null;
  }
  const res = {};
  if (pipfile.source) {
    res.registryUrls = pipfile.source.map(source => source.url);
  }

  res.deps = [
    ...extractFromSection(pipfile, 'packages'),
    ...extractFromSection(pipfile, 'dev-packages'),
  ];
  if (res.deps.length) {
    return res;
  }
  return null;
}

function extractFromSection(pipfile, section) {
  if (!(section in pipfile)) {
    return [];
  }
  const specifierRegex = new RegExp(`^${specifierPattern}$`);
  const pipfileSection = pipfile[section];

  const deps = Object.entries(pipfileSection)
    .map(x => {
      const [depName, requirements] = x;
      let currentValue;
      let pipenvNestedVersion;
      let skipReason;
      if (requirements.git) {
        skipReason = 'git-dependency';
      } else if (requirements.file) {
        skipReason = 'file-dependency';
      } else if (requirements.path) {
        skipReason = 'local-dependency';
      } else if (requirements.version) {
        currentValue = requirements.version;
        pipenvNestedVersion = true;
      } else if (is.object(requirements)) {
        skipReason = 'any-version';
      } else {
        currentValue = requirements;
      }
      if (currentValue === '*') {
        skipReason = 'any-version';
      }
      if (!skipReason) {
        const packageMatches = packageRegex.exec(depName);
        if (!packageMatches) {
          logger.info(
            `Skipping dependency with malformed package name "${depName}".`
          );
          skipReason = 'invalid-name';
        }
        const specifierMatches = specifierRegex.exec(currentValue);
        if (!specifierMatches) {
          logger.debug(
            `Skipping dependency with malformed version specifier "${currentValue}".`
          );
          skipReason = 'invalid-version';
        }
      }
      const dep = {
        depType: section,
        depName,
      };
      if (currentValue) dep.currentValue = currentValue;
      if (skipReason) {
        dep.skipReason = skipReason;
      } else {
        dep.datasource = 'pypi';
      }
      if (pipenvNestedVersion) dep.pipenvNestedVersion = pipenvNestedVersion;
      if (requirements.index) {
        if (is.array(pipfile.source)) {
          const source = pipfile.source.find(
            item => item.name === requirements.index
          );
          if (source) {
            dep.registryUrls = [source.url];
          }
        }
      }
      return dep;
    })
    .filter(Boolean);
  return deps;
}
