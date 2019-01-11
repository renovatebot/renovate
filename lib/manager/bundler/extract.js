const { isValid } = require('../../versioning/ruby');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  const res = {
    registryUrls: [],
    deps: [],
  };
  const lines = content.split('\n');
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const sourceMatch = line.match(/^source "([^"]+)"\s*$/);
    if (sourceMatch) {
      res.registryUrls.push(sourceMatch[1]);
    }
    const gemMatch = line.match(/^gem "([^"]+)"(,\s+"([^"]+)")?/);
    if (gemMatch) {
      const dep = {
        depName: gemMatch[1],
        lineNumber,
      };
      if (gemMatch[3]) {
        dep.currentValue = gemMatch[3];
        if (!isValid(dep.currentValue)) {
          dep.skipReason = 'invalid-value';
        }
      } else {
        dep.skipReason = 'no-version';
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
          groupContent += groupLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const groupRes = extractPackageFile(groupContent);
      if (groupRes) {
        res.deps = res.deps.concat(
          groupRes.deps.map(dep => ({
            ...dep,
            depTypes,
            lineNumber: dep.lineNumber + groupLineNumber + 1,
          }))
        );
      }
    }
    const sourceBlockMatch = line.match(/^source\s+"(.*?)"\s+do/);
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
      const sourceRes = extractPackageFile(sourceContent);
      if (sourceRes) {
        res.deps = res.deps.concat(
          sourceRes.deps.map(dep => ({
            ...dep,
            registryUrls: [repositoryUrl],
            lineNumber: dep.lineNumber + sourceLineNumber + 1,
          }))
        );
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
      const platformsRes = extractPackageFile(platformsContent);
      if (platformsRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          platformsRes.deps.map(dep => ({
            ...dep,
            lineNumber: dep.lineNumber + platformsLineNumber + 1,
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
      const ifRes = extractPackageFile(ifContent);
      if (ifRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          ifRes.deps.map(dep => ({
            ...dep,
            lineNumber: dep.lineNumber + ifLineNumber + 1,
          }))
        );
      }
    }
  }
  if (!res.deps.length && !res.registryUrls.length) {
    return null;
  }
  return res;
}
