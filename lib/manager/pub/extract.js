const yaml = require('js-yaml');
const npm = require('../../versioning/npm/index');
const { logger } = require('../../logger');

module.exports = {
  extractPackageFile,
};

function getDeps(depsObj, preset = {}) {
  if (!depsObj) return [];
  return Object.keys(depsObj).reduce((acc, depName) => {
    if (depName === 'meta') return acc;

    const section = depsObj[depName];
    let currentValue = null;

    if (section && npm.isValid(section.toString())) {
      currentValue = section.toString();
    }

    if (section.version && npm.isValid(section.version.toString())) {
      currentValue = section.version.toString();
    }

    /** @type any */
    const dep = { ...preset, depName, currentValue };
    if (!currentValue) {
      dep.skipReason = 'not-a-version';
    }

    return [...acc, dep];
  }, []);
}

function extractPackageFile(content, packageFile) {
  try {
    const doc = yaml.safeLoad(content);
    const deps = [
      ...getDeps(doc.dependencies, {
        depType: 'dependencies',
      }),
      ...getDeps(doc.dev_dependencies, {
        depType: 'dev_dependencies',
      }),
    ];

    if (deps.length) {
      return {
        packageFile,
        manager: 'pub',
        datasource: 'dart',
        deps,
      };
    }
  } catch (e) {
    logger.info({ packageFile }, 'Can not parse dependency');
  }
  return null;
}
