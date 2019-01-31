const { nonEmptyArray } = require('@sindresorhus/is');
const { getDependency } = require('./get');

async function getPkgReleases({ lookupName: dependency, registryUrls }) {
  const registries = nonEmptyArray(registryUrls) ? registryUrls : [];

  for (const registry of registries) {
    const pkg = await getDependency({ dependency, registry });
    if (pkg) {
      return pkg;
    }
  }

  return null;
}

module.exports = {
  getPkgReleases,
};
