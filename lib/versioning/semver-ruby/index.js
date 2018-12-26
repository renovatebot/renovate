const { parse: parseVersion } = require('./version');

const getMajor = version => parseVersion(version).major;
const getMinor = version => parseVersion(version).minor;
const getPatch = version => parseVersion(version).patch;

module.exports = {
  getMajor,
  getMinor,
  getPatch,
};
