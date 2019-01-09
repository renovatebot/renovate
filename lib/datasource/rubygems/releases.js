const { nonEmptyArray } = require('@sindresorhus/is');
const { getDependency } = require('./get');

async function getPkgReleases({ fullname: dependency }, config = {}) {
  const { registryUrls, compatibility = {} } = config;
  const regestries = nonEmptyArray(registryUrls) ? registryUrls : [];

  for (const registry of regestries) {
    const pkg = await getDependency({ dependency, registry, compatibility });
    if (pkg) {
      return pkg;
    }
  }

  return null;
}

module.exports = {
  getPkgReleases,
};
