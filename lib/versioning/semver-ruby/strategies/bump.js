const { gte, lte } = require('@snyk/ruby-semver');
const { EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE } = require('../operator');
const { parse: parseRange } = require('../range');
const {
  increment: incrementVersion,
  decrement: decrementVersion,
} = require('../version');

module.exports = ({ range, to }) => {
  const ranges = range.split(',').map(parseRange);
  const results = ranges.map(({ operator, version }) => {
    switch (operator) {
      case null:
        return to;
      case GT:
        return lte(to, version)
          ? `${GT} ${version}`
          : `${GT} ${decrementVersion(to)}`;
      case LT:
        return gte(to, version)
          ? `${LT} ${incrementVersion(version, to)}`
          : `${LT} ${version}`;
      case GTE:
      case LTE:
      case PGTE:
      case EQUAL:
        return `${operator} ${to}`;
      case NOT_EQUAL:
        return `${NOT_EQUAL} ${version}`;
      default:
        logger.warn(`Unsupported operator '${operator}'`);
        return null;
    }
  });

  return results.join(', ');
};
