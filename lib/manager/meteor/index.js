const { detectPackageFiles } = require('./detect');
const { getPackageUpdates } = require('../npm/package');
const { setNewValue } = require('./update');

module.exports = {
  detectPackageFiles,
  getPackageUpdates,
  setNewValue,
};
