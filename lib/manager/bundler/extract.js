const { logger } = require('../../logger');
const { isValid } = require('../../versioning/ruby');

module.exports = {
  extractPackageFile,
};

async function extractPackageFile(content, fileName) {
  const res = {
    registryUrls: [],
    deps: [],
  };
  const lines = content.split('\n');
  const delimiters = ['"', "'"];
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    let sourceMatch;
    for (const delimiter of delimiters) {
      sourceMatch =
        sourceMatch ||
        line.match(
          new RegExp(`^source ${delimiter}([^${delimiter}]+)${delimiter}\\s*$`)
        );
    }
    if (sourceMatch) {
      res.registryUrls.push(sourceMatch[1]);
    }
    let rubyMatch;
    for (const delimiter of delimiters) {
      rubyMatch =
        rubyMatch ||
        line.match(
          new RegExp(`^ruby ${delimiter}([^${delimiter}]+)${delimiter}`)
        );
    }
    if (rubyMatch) {
      res.compatibility = { ruby: rubyMatch[1] };
    }
    let gemMatch;
    let gemDelimiter;
    for (const delimiter of delimiters) {
      const gemMatchRegex = `^gem ${delimiter}([^${delimiter}]+)${delimiter}(,\\s+${delimiter}([^${delimiter}]+)${delimiter}){0,2}`;
      if (line.match(new RegExp(gemMatchRegex))) {
        gemDelimiter = delimiter;
        gemMatch = gemMatch || line.match(new RegExp(gemMatchRegex));
      }
    }
    if (gemMatch) {
      const dep = {
        depName: gemMatch[1],
        managerData: { lineNumber },
      };
      if (gemMatch[3]) {
        dep.currentValue = gemMatch[0]
          .substring(`gem ${gemDelimiter}${dep.depName}${gemDelimiter},`.length)
          .replace(new RegExp(gemDelimiter, 'g'), '')
          .trim();
        if (!isValid(dep.currentValue)) {
          dep.skipReason = 'invalid-value';
        }
      } else {
        dep.skipReason = 'no-version';
      }
      if (!dep.skipReason) {
        dep.datasource = 'rubygems';
      }
      res.deps.push(dep);
    }
    const groupMatch = line.match(/^group\s+(.*?)\s+do/);
    if (groupMatch) {
      const depTypes = groupMatch[1]
        .split(',')
        .map(group => group.trim())
        .map(group => group.replace(/^:/, ''));
      const groupLineNumber = lineNumber;
      let groupContent = '';
      let groupLine = '';
      while (lineNumber < lines.length && groupLine !== 'end') {
        lineNumber += 1;
        groupLine = lines[lineNumber];
        if (groupLine !== 'end') {
          groupContent += (groupLine || '').replace(/^ {2}/, '') + '\n';
        }
      }
      const groupRes = await extractPackageFile(groupContent);
      if (groupRes) {
        res.deps = res.deps.concat(
          groupRes.deps.map(dep => ({
            ...dep,
            depTypes,
            managerData: {
              lineNumber: dep.managerData.lineNumber + groupLineNumber + 1,
            },
          }))
        );
      }
    }
    for (const delimiter of delimiters) {
      const sourceBlockMatch = line.match(
        new RegExp(`^source\\s+${delimiter}(.*?)${delimiter}\\s+do`)
      );
      if (sourceBlockMatch) {
        const repositoryUrl = sourceBlockMatch[1];
        const sourceLineNumber = lineNumber;
        let sourceContent = '';
        let sourceLine = '';
        while (lineNumber < lines.length && sourceLine !== 'end') {
          lineNumber += 1;
          sourceLine = lines[lineNumber];
          if (sourceLine !== 'end') {
            sourceContent += sourceLine.replace(/^ {2}/, '') + '\n';
          }
        }
        const sourceRes = await extractPackageFile(sourceContent);
        if (sourceRes) {
          res.deps = res.deps.concat(
            sourceRes.deps.map(dep => ({
              ...dep,
              registryUrls: [repositoryUrl],
              managerData: {
                lineNumber: dep.managerData.lineNumber + sourceLineNumber + 1,
              },
            }))
          );
        }
      }
    }
    const platformsMatch = line.match(/^platforms\s+(.*?)\s+do/);
    if (platformsMatch) {
      const platformsLineNumber = lineNumber;
      let platformsContent = '';
      let platformsLine = '';
      while (lineNumber < lines.length && platformsLine !== 'end') {
        lineNumber += 1;
        platformsLine = lines[lineNumber];
        if (platformsLine !== 'end') {
          platformsContent += platformsLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const platformsRes = await extractPackageFile(platformsContent);
      if (platformsRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          platformsRes.deps.map(dep => ({
            ...dep,
            managerData: {
              lineNumber: dep.managerData.lineNumber + platformsLineNumber + 1,
            },
          }))
        );
      }
    }
    const ifMatch = line.match(/^if\s+(.*?)/);
    if (ifMatch) {
      const ifLineNumber = lineNumber;
      let ifContent = '';
      let ifLine = '';
      while (lineNumber < lines.length && ifLine !== 'end') {
        lineNumber += 1;
        ifLine = lines[lineNumber];
        if (ifLine !== 'end') {
          ifContent += ifLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const ifRes = await extractPackageFile(ifContent);
      if (ifRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          ifRes.deps.map(dep => ({
            ...dep,
            managerData: {
              lineNumber: dep.managerData.lineNumber + ifLineNumber + 1,
            },
          }))
        );
      }
    }
  }
  if (!res.deps.length && !res.registryUrls.length) {
    return null;
  }
  if (fileName) {
    const gemfileLock = fileName + '.lock';
    const lockContent = await platform.getFile(gemfileLock);
    if (lockContent) {
      logger.debug({ packageFile: fileName }, 'Found Gemfile.lock file');
      const bundledWith = lockContent.match(/\nBUNDLED WITH\n\s+(.*?)(\n|$)/);
      if (bundledWith) {
        res.compatibility = res.compatibility || {};
        res.compatibility.bundler = bundledWith[1];
      }
    }
  }
  return res;
}
