
const {
  gte,
  lte,
  parse,
  satisfies,
} = require('@renovate/pep440');

const {
  parse: parseRange,
} = require('@renovate/pep440/lib/specifier');


module.exports = {
  getNewValue,
};

function getFutureVersion(baseVersion, toVersion) {
  const toRelease = parse(toVersion).release;
  const baseRelease = parse(baseVersion).release;
  let found = false;
  const futureRelease = baseRelease.map((basePart, index) => {
    if (found) {
      return 0;
    }
    const toPart = toRelease[index] || 0;
    if (toPart > basePart) {
      found = true;
      return toPart + 1;
    }
    return toPart;
  });
  if (!found) {
    futureRelease[futureRelease.length - 1] += 1;
  }
  return futureRelease.join('.');
}

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  // easy pin
  if (rangeStrategy === 'pin') {
    return '==' + toVersion;
  }
  const ranges = parseRange(currentValue);
  if (!ranges) {
    logger.warn('Invalid currentValue: ' + currentValue);
    return null;
  }
  if (!ranges.length) {
    // an empty string is an allowed value for PEP440 range
    // it means get any version
    logger.warn('Empty currentValue: ' + currentValue);
    return currentValue;
  }
  if (rangeStrategy === 'replace') {
    if (satisfies(toVersion, currentValue)) {
      return currentValue;
    }
  }
  if (!['replace', 'bump'].includes(rangeStrategy)) {
    logger.warn('Unsupported rangeStrategy: ' + rangeStrategy);
    return null;
  }
  if (ranges.some((r) => Boolean(r.legacy))) {
    // the operator "===" is used for legacy non PEP440 versions
    logger.warn('Arbitrary equality not supported: ' + currentValue);
    return currentValue;
  }
  const result = ranges.map(range => {
    // used to exclude versions,
    // we assume that's for a good reason
    if (range.operator === '!=') {
      return range.operator + range.version;
    }

    // used to mark minimum supported version
    if (['>', '>='].includes(range.operator)) {
      if (lte(toVersion, range.version)) {
        // this looks like a rollback
        return '>=' + toVersion;
      }
      // otherwise treat it same as exclude
      return range.operator + range.version;
    }

    // this is used to exclude future versions
    if (range.operator === '<') {
      // if toVersion is that future version
      if (gte(toVersion, range.version)) {
        // now here things get tricky
        // we calculate the new future version
        const futureVersion = getFutureVersion(range.version, toVersion);
        return range.operator + futureVersion;
      }
      // otherwise treat it same as exclude
      return range.operator + range.version;
    }

    // keep the .* suffix
    if (range.prefix) {
      return range.operator + toVersion + '.*';
    }

    if (['==', '~=', '<='].includes(range.operator)) {
      return range.operator + toVersion;
    }

    // unless PEP440 changes, this won't happen
    // instanbul ignore next
    return null;
  });
  return result.filter(Boolean).join();
}
