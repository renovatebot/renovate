import is from '@sindresorhus/is';

const { getDependency } = require('./get');
const { getRubygemsOrgDependency } = require('./get-rubygems-org');

/** @param {{lookupName:string, registryUrls?: string[]}} opt */
async function getPkgReleases({ lookupName, registryUrls }) {
  const registries = is.nonEmptyArray(registryUrls) ? registryUrls : [];

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

export { getPkgReleases };
