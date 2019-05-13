const { nonEmptyArray } = require('@sindresorhus/is');
const { getDependency } = require('./get');
const { getRubygemsOrgDependency } = require('./get-rubygems-org');

async function getPkgReleases({ lookupName, registryUrls }) {
  const registries = nonEmptyArray(registryUrls) ? registryUrls : [];

  for (const registry of registries) {
    let pkg;
    if (registry.endsWith('rubygems.org')) {
      pkg = await getRubygemsOrgDependency(lookupName);
    } else {
      pkg = await getDependency({ dependency: lookupName, registry });
    }
    if (pkg) {
      return pkg;
    }
  }

  return null;
}

module.exports = {
  getPkgReleases,
};
