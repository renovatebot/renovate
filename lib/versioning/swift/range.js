const semver = require('semver');

const fromParam = /^\s*from\s*:\s*"([^"]+)"\s*$/;
const fromRange = /^\s*"([^"]+)"\s*\.\.\.\s*$/;
const binaryRange = /^\s*"([^"]+)"\s*(\.\.[.<])\s*"([^"]+)"\s*$/;
const toRange = /^\s*(\.\.[.<])\s*"([^"]+)"\s*$/;

function toSemverRange(range) {
  if (fromParam.test(range)) {
    const [, version] = range.match(fromParam);
    if (semver.valid(version)) {
      const nextMajor = `${semver.major(version) + 1}.0.0`;
      return `>=${version} <${nextMajor}`;
    }
  } else if (fromRange.test(range)) {
    const [, version] = range.match(fromRange);
    if (semver.valid(version)) {
      return `>=${version}`;
    }
  } else if (binaryRange.test(range)) {
    const [, fromVersion, op, toVersion] = range.match(binaryRange);
    if (semver.valid(fromVersion) && semver.valid(toVersion)) {
      return op === '..<'
        ? `>=${fromVersion} <${toVersion}`
        : `>=${fromVersion} <=${toVersion}`;
    }
  } else if (toRange.test(range)) {
    const [, op, toVersion] = range.match(toRange);
    if (semver.valid(toVersion)) {
      return op === '..<' ? `<${toVersion}` : `<=${toVersion}`;
    }
  }
  return null;
}

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  if (fromParam.test(currentValue)) {
    const [, version] = currentValue.match(fromParam);
    return currentValue.replace(version, toVersion);
  }
  if (fromRange.test(currentValue)) {
    const [, version] = currentValue.match(fromRange);
    return currentValue.replace(version, toVersion);
  }
  if (binaryRange.test(currentValue)) {
    const [, , , version] = currentValue.match(binaryRange);
    return currentValue.replace(version, toVersion);
  }
  if (toRange.test(currentValue)) {
    const [, , version] = currentValue.match(toRange);
    return currentValue.replace(version, toVersion);
  }
  return currentValue;
}

module.exports = {
  toSemverRange,
  getNewValue,
};
