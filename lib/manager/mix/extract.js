module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('mix.extractPackageFile()');
  const deps = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(/{:(\w+),\s*([^:]+)?:?\s*"(~>\s)?(.*)"}/);
    if (match) {
      const depName = match[1];
      const datasource = match[2];
      const currentValue = match[4];
      const dep = {
        depType: 'hex',
        depName,
        currentValue,
        lineNumber,
        datasource: 'hex',
      };
    }
  }
}
