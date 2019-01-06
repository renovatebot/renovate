const { resetMemCache, resetCache } = require('./get');
const { getPreset } = require('./presets');
const { getPkgReleases } = require('./releases');
const { maskToken } = require('./mask');
const { setNpmrc } = require('./npmrc');

module.exports = {
  maskToken,
  setNpmrc,
  getPreset,
  getPkgReleases,
  resetMemCache,
  resetCache,
};
