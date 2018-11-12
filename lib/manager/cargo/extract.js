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
        const dep = lines[lineNumber + i].split(' ')[0];
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
  return { deps };
}
