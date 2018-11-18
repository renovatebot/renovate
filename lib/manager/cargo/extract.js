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
// TODO: Refactor
// TODO: Find and fix all corner cases
function extractPackageFile(content, fileName) {
  logger.trace(`cargo.extractPackageFile(${fileName})`);
  const deps = [];
  let lineNumber = 0;
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match('dependencies[.]');
    if (match) {
      const dep = {};
      let input = match.input;
      input = input.replace(/[[\]]+/g, '');
      input = input.split('.');
      dep.depName = input[input.length - 1];
      // Record the line number of [*dependencies.<depName>] expression
      dep.lineNumber = lineNumber;
      let name = '';
      let i = 1;
      while (name !== 'version') {
        const field = lines[lineNumber + i].split('=');
        name = field[0].trim();
        if (name === 'version') {
          dep.currentValue = field[1]
            .trim()
            .replace(/['"]+/g, '')
            .trim();
        }
        i += 1;
      }
      deps.push(dep);
    } else if (line.match('dependencies')) {
      let i = 1;
      while (
        lineNumber + i < lines.length &&
        lines[lineNumber + i].trim()[0] !== '['
      ) {
        let dep = null;
        const l = lines[lineNumber + i];
        if (l.match('{*}')) {
          dep = getInlineDep(l);
        } else {
          dep = getDep(l);
        }
        if (dep) {
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
  for (let i = 0; i < deps.length; i += 1) {
    if (!semver.isValid(deps[i].currentValue)) {
      deps[i].skipReason = 'unknown-version';
    }
  }
  return { deps };
}

function getDep(line) {
  const entry = line.split('=');
  const dep = {};
  const depName = entry[0];
  if (depName) {
    const currentValue = entry[1]
      .trim()
      .replace(/['"]+/g, '')
      .trim();
    dep.currentValue = currentValue;
    dep.depName = depName;
    return dep;
  }
  return null;
}

// NOTE: Some corner cases, like nested {} might not be covered
// TODO: Find and fix corner cases
function getInlineDep(line) {
  const dep = {};
  let content = line.split('=');
  dep.depName = content[0];
  content = content.slice(1);
  content = content.join('=');
  content = content.trim().replace(/[{}]+/g, '');
  const fields = content.split(',');
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i].split('=');
    const name = field[0].trim();
    const value = field[1].trim();
    if (name === 'version') {
      dep.currentValue = value.replace(/['"]+/g, '').trim();
      return dep;
    }
  }
  return null;
}
