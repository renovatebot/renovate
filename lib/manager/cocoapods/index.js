const dependencyPattern = `pod +'(.+)' *, *'(.+)'`;

function extractPackageFile(content) {
  logger.trace('cocoapods.extractPackageFile()');

  const regex = new RegExp(`^${dependencyPattern}$`, 'g');
  const deps = content
    .split('\n')
    .map((rawline, lineNumber) => {
      let dep = {};
      const [line, comment] = rawline.split('#').map(part => part.trim());
      regex.lastIndex = 0;
      const matches = regex.exec(line);
      if (!matches) {
        return null;
      }
      const [, depName, currentValue] = matches;
      dep = {
        ...dep,
        depName,
        currentValue,
        lineNumber,
        datasource: 'cocoapods',
      };
      /*     if (
          isValid(currentValue) &&
          isSingleVersion(currentValue) &&
          currentValue.startsWith('==')
        ) {
          dep.fromVersion = currentValue.replace(/^==/, '');
        }
        */
      //Will have to fix this for other operators (should not be pinned)
      dep.fromVersion = currentValue.replace(/^==/, '');
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function updateDependency(fileContent, upgrade) {
  // prettier-ignore
  try {
    logger.debug(`cocoapods.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.currentVersion} ==> ${upgrade.newValue}`);
    const lines = fileContent.split('\n');
    const oldValue = lines[upgrade.lineNumber];
    const newValue = oldValue.replace(new RegExp(dependencyPattern), `  pod '$1', '${upgrade.newValue}'`);
    lines[upgrade.lineNumber] = newValue;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}

module.exports = {
  extractPackageFile,
  updateDependency,
  language: 'swift',
};
