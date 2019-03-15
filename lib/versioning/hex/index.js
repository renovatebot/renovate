const npm = require('../npm');

function hex2npm(input) {
  return input
    .replace(/~>\s*(\d+\.\d+(\.\d+.*)?)/, (str, p1) => '^' + p1.slice(0, -2))
    .replace(/==|and/, '')
    .replace('or', '||')
    .replace(/!=\s*(\d+\.\d+(\.\d+.*)?)/, '>$1 <$1');
}

function npm2hex(input) {
  const res = input
    .split(' ')
    .map(str => str.trim())
    .filter(str => str !== '');
  let output = '';
  const operators = ['^', '=', '>', '<', '<=', '>='];
  // handle and or
  for (let i = 0; i < res.length; i += 1) {
    if (i === res.length - 1) {
      output += res[i];
      break;
    }
    if (i < res.length - 1 && res[i + 1].includes('||')) {
      output += res[i] + ' or ';
      i += 1;
    } else if (!operators.includes(res[i])) output += res[i] + ' and ';
    else output += res[i] + ' ';
  }
  return output;
}

const isLessThanRange = (version, range) =>
  npm.isLessThanRange(hex2npm(version), hex2npm(range));

const isValid = input => npm.isValid(hex2npm(input));

const matches = (version, range) =>
  npm.matches(hex2npm(version), hex2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  npm.maxSatisfyingVersion(versions.map(hex2npm), hex2npm(range));

const minSatisfyingVersion = (versions, range) =>
  npm.minSatisfyingVersion(versions.map(hex2npm), hex2npm(range));

const getNewValue = (currentValue, rangeStrategy, fromVersion, toVersion) => {
  // try diff strategies pin bump ....
  let newSemver = npm.getNewValue(
    hex2npm(currentValue),
    rangeStrategy,
    fromVersion,
    toVersion
  );
  newSemver = npm2hex(newSemver);
  if (currentValue.match(/~>\s*(\d+\.\d+)$/))
    newSemver = newSemver.replace(
      /\^\s*(\d+\.\d+\.\d)/,
      (str, p1) => '~> ' + p1.slice(0, -2)
    );
  else newSemver = newSemver.replace(/\^\s*(\d+\.\d+\.\d)/, '~> $1');

  return newSemver;
};

module.exports = {
  ...npm,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};
