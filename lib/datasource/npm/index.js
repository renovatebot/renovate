const { resetMemCache, resetCache } = require('./get');
const { getPreset } = require('./presets');
const { getPkgReleases } = require('./releases');
const { setNpmrc } = require('./npmrc');

module.exports = {
  setNpmrc,
  getPreset,
  getPkgReleases,
  resetMemCache,
  resetCache,
};
