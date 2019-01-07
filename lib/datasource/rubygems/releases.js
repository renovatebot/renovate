const { nonEmptyArray } = require('@sindresorhus/is');
const { getDependency } = require('./get');

const RUBYGEMS_URL = 'https://rubygems.org';

const getRegistries = (envSources, configSources) =>
  Array.prototype.concat.call(envSources || configSources || RUBYGEMS_URL);

async function getPkgReleases({ fullname: dependency }, config = {}) {
  const { registryUrls, compatibility = {} } = config;

  const envSources = process.env.RUBYGEMS_URL ? process.env.RUBYGEMS_URL : null;
  const configSources = nonEmptyArray(registryUrls) ? registryUrls : null;
  const regestries = getRegistries(envSources, configSources);

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
