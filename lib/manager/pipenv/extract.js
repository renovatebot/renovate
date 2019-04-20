const toml = require('toml');
const is = require('@sindresorhus/is');

// based on https://www.python.org/dev/peps/pep-0508/#names
const packageRegex = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i;
const rangePattern = require('@renovate/pep440/lib/specifier').RANGE_PATTERN;

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
  let registryUrls;
  if (pipfile.source) {
    registryUrls = pipfile.source.map(source => source.url);
  }

  const deps = [
    ...extractFromSection(pipfile, 'packages', registryUrls),
    ...extractFromSection(pipfile, 'dev-packages', registryUrls),
  ];
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function extractFromSection(pipfile, section, registryUrls) {
  if (!(section in pipfile)) {
    return [];
  }
  const specifierRegex = new RegExp(`^${specifierPattern}$`);
  const pipfileSection = pipfile[section];

  Object.keys(pipfileSection).forEach(key => {
    if (is.object(pipfileSection[key]))
      pipfileSection[key].version = pipfileSection[key].version || '*';
  });

  const deps = Object.entries(pipfileSection)
    .map(x => {
      const [depName, requirements] = x;
      let currentValue;
      let pipenvNestedVersion;
      if (requirements.version) {
        currentValue = requirements.version;
        pipenvNestedVersion = true;
      } else if (requirements.git) {
        logger.debug('Skipping git dependency');
        return null;
      } else if (requirements.path) {
        logger.debug('Skipping relative path dependency');
        return null;
      } else {
        currentValue = requirements;
        pipenvNestedVersion = false;
      }
      const packageMatches = packageRegex.exec(depName);
      const specifierMatches = specifierRegex.exec(currentValue);
      let skipReason;
      if (!packageMatches) {
        logger.debug(
          `Skipping dependency with malformed package name "${depName}".`
        );
        return null;
      }
      if (currentValue === '*') {
        skipReason = 'any-version';
      } else if (!specifierMatches) {
        logger.debug(
          `Skipping dependency with malformed version specifier "${currentValue}".`
        );
        return null;
      }
      const dep = {
        depName,
        currentValue,
        pipenvNestedVersion,
        datasource: 'pypi',
        depType: section,
      };
      if (skipReason) {
        dep.skipReason = skipReason;
      }
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }
      return dep;
    })
    .filter(Boolean);
  return deps;
}
