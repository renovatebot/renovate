const { gte, lte } = require('@snyk/ruby-semver');
const { EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE } = require('../operator');
const { floor, increment, decrement } = require('../version');
const { parse: parseRange } = require('../range');

module.exports = ({ range, to }) => {
  const ranges = range.split(',').map(parseRange);
  const results = ranges.map(({ operator, version: ver }) => {
    switch (operator) {
      case null:
        return to;
      case GT:
        return lte(to, ver) ? `${GT} ${ver}` : `${GT} ${decrement(to)}`;
      case LT:
        return gte(to, ver) ? `${LT} ${increment(ver, to)}` : `${LT} ${ver}`;
      case PGTE:
        return `${operator} ${floor(to)}`;
      case GTE:
      case LTE:
      case EQUAL:
        return `${operator} ${to}`;
      case NOT_EQUAL:
        return `${NOT_EQUAL} ${ver}`;
      // istanbul ignore next
      default:
        logger.warn(`Unsupported operator '${operator}'`);
        return null;
    }
  });

  return results.join(', ');
};
