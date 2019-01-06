const { getDependency } = require('./get');
const { setNpmrc } = require('./npmrc');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl, config) {
  if (config && config.npmrc) {
    setNpmrc(config.npmrc);
  }
  const res = await getDependency(purl.fullname, global.testNpmRetries);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}
