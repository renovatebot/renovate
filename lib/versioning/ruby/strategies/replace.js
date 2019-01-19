const { satisfies } = require('@snyk/ruby-semver');
const bump = require('./bump');

module.exports = ({ to, range }) => {
  if (satisfies(to, range)) {
    return range;
  }
  const lastPart = range
    .split(',')
    .map(part => part.trim())
    .pop();
  const newLastPart = bump({ to, range: lastPart });
  // TODO: match precision
  return range.replace(lastPart, newLastPart);
};
