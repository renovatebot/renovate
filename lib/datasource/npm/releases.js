const { getDependency } = require('./get');
const { setNpmrc } = require('./npmrc');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName, npmrc }) {
  if (npmrc) {
    setNpmrc(npmrc);
  }
  const res = await getDependency(lookupName, global.testNpmRetries);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}
