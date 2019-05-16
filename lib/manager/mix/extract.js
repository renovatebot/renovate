const { isValid } = require('../../versioning/hex');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.trace('mix.extractPackageFile()');
  const deps = [];
  const contentArr = content.split('\n');
  const depSectionRegExp = /defp\s+deps.*do/g;
  const depMatchRegExp = /{:(\w+),\s*([^:"]+)?:?\s*"([^"]+)",?\s*(organization: "(.*)")?.*}/gm;

  for (let lineNumber = 0; lineNumber < contentArr.length; lineNumber += 1) {
    if (contentArr[lineNumber].match(depSectionRegExp)) {
      logger.trace(`Matched dep section on line ${lineNumber}`);
      let depBuffer = '';
      do {
        depBuffer += contentArr[lineNumber] + '\n';
        lineNumber += 1;
      } while (!contentArr[lineNumber].includes('end'));
      let depMatch;
      do {
        depMatch = depMatchRegExp.exec(depBuffer);
        if (depMatch) {
          const depName = depMatch[1];
          const datasource = depMatch[2];
          const currentValue = depMatch[3];
          const organization = depMatch[5];

          const dep = {
            depName,
            currentValue,
          };

          dep.datasource = datasource || 'hex';

          if (dep.datasource === 'hex') {
            dep.currentValue = currentValue;
            dep.lookupName = depName;
          }

          if (organization) {
            dep.lookupName += ':' + organization;
          }

          if (!isValid(currentValue)) {
            dep.skipReason = 'unsupported-version';
          }

          if (dep.datasource !== 'hex') {
            dep.skipReason = 'non-hex depTypes';
          }

          // Find dep's line number
          for (let i = 0; i < contentArr.length; i += 1)
            if (contentArr[i].includes(`:${depName},`)) dep.lineNumber = i;

          deps.push(dep);
        }
      } while (depMatch);
    }
  }
  return { deps };
}
