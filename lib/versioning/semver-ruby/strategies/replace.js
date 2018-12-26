const { satisfies } = require('@snyk/ruby-semver');
const bump = require('./bump');

module.exports = ({ range, to }) => {
  if (satisfies(to, range)) {
    return range;
  }

  return bump({ range, to });
};
