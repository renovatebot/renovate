const { detectPackageFiles } = require('./detect');
const { getPackageUpdates } = require('../npm/package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

module.exports = {
  detectPackageFiles,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
