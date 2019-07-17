const { getDependency } = require('./get');
const { setNpmrc } = require('./npmrc');

module.exports = {
  getPkgReleases,
};

/**
 *
 * @param {{lookupName: string, npmrc?: string}} args
 */
async function getPkgReleases({ lookupName, npmrc }) {
  if (npmrc) {
    setNpmrc(npmrc);
  }
  const res = await getDependency(lookupName);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}
