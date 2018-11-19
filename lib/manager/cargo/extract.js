const versioning = require('../../versioning');

const semver = versioning('semver');

module.exports = {
  extractPackageFile,
  getDep,
  getInlineTableDep,
  getTableDep,
};

/* Quote from TOML spec. */
/*
Inline tables are intended to appear on a single line. No newlines are
allowed between the curly braces unless they are valid within a value.
Even so, it is strongly discouraged to break an inline table onto
multiples lines. If you find yourself gripped with this desire, it
means you should be using standard tables.
*/

// TODO: Find and fix all corner cases
function extractPackageFile(content, fileName) {
  logger.trace(`cargo.extractPackageFile(${fileName})`);
  let deps = [];
  let lineNumber = 0;
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match('dependencies[.]');
    if (match) {
      const dep = getTableDep(match, lines, lineNumber);
      deps.push(dep);
    } else if (line.match('dependencies')) {
      const sectionDeps = getDeps(lines, lineNumber);
      deps = [].concat(deps, sectionDeps);
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

// Get dependencies in a [dependencies], or [dev-dependencies],
// or [build-dependencies], etc section
function getDeps(lines, lineNumber) {
  const deps = [];
  let i = 1;
  while (
    lineNumber + i < lines.length &&
    lines[lineNumber + i].trim()[0] !== '['
  ) {
    let dep = null;
    const l = lines[lineNumber + i];
    if (l.match('{*}')) {
      dep = getInlineTableDep(l);
    } else {
      dep = getDep(l);
    }
    if (dep) {
      dep.lineNumber = lineNumber + i;
      deps.push(dep);
    }
    i += 1;
  }
  return deps;
}

// Get a normal dependency name and version
// Example: foo = '1.2.3'
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
    dep.depType = 'normal';
    return dep;
  }
  return null;
}

// NOTE: Some corner cases, like nested {} might not be covered
// TODO: Find and fix corner cases
// Get dependency name and version from an inline table
// Example: pcap-sys = { version = "0.1", path = "pcap-sys" }
function getInlineTableDep(line) {
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
      dep.depType = 'inline-table';
      return dep;
    }
  }
  return null;
}

// Get dependency name and version from a standard TOML table
function getTableDep(match, lines, lineNumber) {
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
      dep.depType = 'standard-table';
      dep.versionLineNumber = lineNumber + i;
    }
    i += 1;
  }
  return dep;
}
