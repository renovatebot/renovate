const versioning = require('../../versioning');

const semver = versioning('semver');

module.exports = {
  extractPackageFile,
};

/* Quote from TOML spec. */
/*
Inline tables are intended to appear on a single line. No newlines are
allowed between the curly braces unless they are valid within a value.
Even so, it is strongly discouraged to break an inline table onto
multiples lines. If you find yourself gripped with this desire, it
means you should be using standard tables.
*/

// TODO: Treat invalid versions gracefully
// TODO: Implement inline table dependency format
// TODO: Implement normal table dependency format
// FIXME: extractPackageFile erroneously treats `features` line as a dependency in Cargo.1.toml test
// FIXME: extractPackageFile erroneously treats `version` line as a dependency in Cargo.1.toml test
function extractPackageFile(content, fileName) {
  logger.trace(`cargo.extractPackageFile(${fileName})`);
  const deps = [];
  let lineNumber = 0;
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match('dependencies');
    if (match) {
      let i = 1;
      while (
        lines[lineNumber + i].trim()[0] !== '[' &&
        lineNumber + i < lines.length
      ) {
        const entry = lines[lineNumber + i].split('=');
        const dep = {};
        const depName = entry[0];
        if (depName) {
          const currentValue = entry[1].trim().replace(/['"]+/g, '');
          if (!semver.isValid(currentValue)) {
            dep.skipReason = 'unknown-version';
          }
          dep.currentValue = currentValue;
          dep.depName = depName;
          dep.lineNumber = lineNumber + i;
          deps.push(dep);
        }
        i += 1;
      }
    }
    lineNumber += 1;
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
