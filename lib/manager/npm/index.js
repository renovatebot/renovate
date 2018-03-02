const { detectPackageFiles } = require('./detect');
const { getPackageUpdates } = require('./package');
const { setNewValue } = require('./update');

module.exports = {
  detectPackageFiles,
  getPackageUpdates,
  setNewValue,
};
