const semver = require('../semver');

function cargo2npm(input) {
  return input.replace(',', ' ');
}

const isValid = input => semver.isValid(cargo2npm(input));

module.exports = {
  ...semver,
  isValid,
};
