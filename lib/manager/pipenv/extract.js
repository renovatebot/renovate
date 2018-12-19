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
    registryUrls = pipfile.source.map(source =>
      source.url.replace(/simple(\/)?$/, 'pypi/')
    );
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
  const deps = Object.entries(pipfile[section])
    .map(x => {
      const [depName, requirements] = x;
      let currentValue;
      let pipenvNestedVersion;
      if (requirements.version) {
        currentValue = requirements.version;
        pipenvNestedVersion = true;
      } else {
        currentValue = requirements;
        pipenvNestedVersion = false;
      }
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
        pipenvNestedVersion,
        purl: 'pkg:pypi/' + depName,
        depType: section,
      };
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }
      return dep;
    })
    .filter(Boolean);
  return deps;
}
