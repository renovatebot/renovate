const { inc: increment, major, minor, valid } = require('semver');
const { parseRange } = require('semver-utils');

module.exports = {
  getNewValue,
};

function getNewValue(config, currentValue, fromVersion, toVersion) {
  const { rangeStrategy } = config;
  if (rangeStrategy === 'pin' || valid(currentValue)) {
    return toVersion;
  }
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];
  if (rangeStrategy === 'widen') {
    const newValue = getNewValue(
      { ...config, rangeStrategy: 'replace' },
      currentValue,
      fromVersion,
      toVersion
    );
    if (element.operator && element.operator.startsWith('<')) {
      // TODO fix this
      const splitCurrent = currentValue.split(element.operator);
      splitCurrent.pop();
      return splitCurrent.join(element.operator) + newValue;
    }
    if (parsedRange.length > 1) {
      const previousElement = parsedRange[parsedRange.length - 2];
      if (previousElement.operator === '-') {
        const splitCurrent = currentValue.split('-');
        splitCurrent.pop();
        return splitCurrent.join('-') + '- ' + newValue;
      }
      if (element.operator && element.operator.startsWith('>')) {
        logger.warn(`Complex ranges ending in greater than are not supported`);
        return null;
      }
    }
    return `${currentValue} || ${newValue}`;
  }
  // console.log(range);
  // Simple range
  if (config.rangeStrategy === 'bump') {
    if (parsedRange.length === 1) {
      if (element.operator === '^') {
        return `^${toVersion}`;
      }
      if (element.operator === '~') {
        return `~${toVersion}`;
      }
      if (element.operator === '=') {
        return `=${toVersion}`;
      }
      if (element.operator === '>=') {
        return currentValue.includes('>= ')
          ? `>= ${toVersion}`
          : `>=${toVersion}`;
      }
    }
    logger.warn(
      'Unsupported range type for rangeStrategy=bump: ' + currentValue
    );
    return null;
  }
  if (element.operator === '^') {
    if (!fromVersion) {
      return `^${toVersion}`;
    }
    if (major(toVersion) === major(fromVersion)) {
      if (major(toVersion) === 0) {
        if (minor(toVersion) === 0) {
          return `^${toVersion}`;
        }
        return `^${major(toVersion)}.${minor(toVersion)}.0`;
      }
      return `^${toVersion}`;
    }
    return `^${major(toVersion)}.0.0`;
  }
  if (element.operator === '=') {
    return `=${toVersion}`;
  }
  if (element.operator === '~') {
    return `~${major(toVersion)}.${minor(toVersion)}.0`;
  }
  if (element.operator === '<=') {
    let res;
    if (element.patch) {
      res = `<=${toVersion}`;
    } else if (element.minor) {
      res = `<=${major(toVersion)}.${minor(toVersion)}`;
    } else {
      res = `<=${major(toVersion)}`;
    }
    if (currentValue.includes('<= ')) {
      res = res.replace('<=', '<= ');
    }
    return res;
  }
  if (element.operator === '<') {
    let res;
    if (currentValue.endsWith('.0.0')) {
      const newMajor = major(toVersion) + 1;
      res = `<${newMajor}.0.0`;
    } else if (element.patch) {
      res = `<${increment(toVersion, 'patch')}`;
    } else if (element.minor) {
      res = `<${major(toVersion)}.${minor(toVersion) + 1}`;
    } else {
      res = `<${major(toVersion) + 1}`;
    }
    if (currentValue.includes('< ')) {
      res = res.replace('<', '< ');
    }
    return res;
  }
  if (!element.operator) {
    if (element.minor) {
      if (element.minor === 'x') {
        return `${major(toVersion)}.x`;
      }
      if (element.patch === 'x') {
        return `${major(toVersion)}.${minor(toVersion)}.x`;
      }
      return `${major(toVersion)}.${minor(toVersion)}`;
    }
    return `${major(toVersion)}`;
  }
  return toVersion;
}
