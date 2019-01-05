const is = require('@sindresorhus/is');

const { getDependency } = require('./get');
const { setNpmrc } = require('./npmrc');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(input, config) {
  if (is.string(input)) {
    const depName = input;
    return getDependency(depName, global.testNpmRetries);
  }
  if (config) {
    const trustLevel = config.global ? config.global.trustLevel : 'low';
    setNpmrc(config.npmrc, trustLevel);
  }
  const purl = input;
  const res = await getDependency(purl.fullname, global.testNpmRetries);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}
