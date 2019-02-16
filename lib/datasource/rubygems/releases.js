const { nonEmptyArray } = require('@sindresorhus/is');
const { getDependency } = require('./get');

async function getPkgReleases({ lookupName, registryUrls }) {
  const registries = nonEmptyArray(registryUrls) ? registryUrls : [];

  for (const registry of registries) {
    const pkg = await getDependency({ dependency: lookupName, registry });
    if (pkg) {
      return pkg;
    }
  }

  return null;
}

module.exports = {
  getPkgReleases,
};
