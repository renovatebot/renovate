const { satisfies } = require('@snyk/ruby-semver');
const bump = require('./bump');

module.exports = ({ to, range }) =>
  satisfies(to, range) ? range : bump({ to, range });
