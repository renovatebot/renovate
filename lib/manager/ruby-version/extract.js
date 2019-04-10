const ruby = require('../../versioning/ruby');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.trace('ruby-version.extractPackageFile()');
  const dep = {
    depName: 'ruby',
    currentValue: content.trim(),
    datasource: 'rubyVersion',
  };
  if (!ruby.isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
