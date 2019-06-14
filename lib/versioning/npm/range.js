const {
  inc: increment,
  major,
  minor,
  patch,
  prerelease,
  satisfies,
  valid: isVersion,
  validRange,
  compare,
} = require('semver');
const { parseRange } = require('semver-utils');

module.exports = {
  getNewValue,
};

function cappedWithNewValue(currentValue, toVersion) {
  const branchSplit = /\s*\|\|\s*/;
  const branches = currentValue.split(branchSplit).map(x => x.trim());

  let isShrinked = false;
  let maxVersion = null;
  let maxVersionIdx = null;
  let nearestRangeVer = null;
  let nearestRangeOp = null;
  let nearestRangeBranch = null;
  let nearestRangeBranchIdx = null;
  const resultBranches = branches.reduce((accum, branch, idx) => {
    const singleVersion = branch.replace(/^=?/, '');
    if (isVersion(singleVersion)) {
      if (!maxVersion) {
        maxVersion = branch;
        maxVersionIdx = idx;
      } else if (compare(maxVersion, singleVersion) === -1) {
        maxVersion = singleVersion;
        maxVersionIdx = idx;
      }
      return [...accum, branch];
    }
    const parsedBranch = validRange(branch);
    if (parsedBranch) {
      let max = null;
      let maxOp = null;
      parsedBranch
        .split(/\s+/)
        .map(x => x.split(/([<>]=?)/))
        .forEach(([, op, version]) => {
          if (!max || compare(max, version) === -1) {
            max = version;
            maxOp = op;
          }
        });

      const cmp = compare(max, toVersion);
      if (cmp === -1) {
        if (maxOp.startsWith('<')) {
          // extend
          if (!nearestRangeVer || compare(nearestRangeVer, max) !== 1) {
            nearestRangeVer = max;
            nearestRangeOp = maxOp;
            nearestRangeBranch = parsedBranch;
            nearestRangeBranchIdx = idx;
          }
        } else {
          // shrink
          isShrinked = true;
          return [...accum, `${branch} <=${toVersion}`];
        }
      } else if (cmp === 1) {
        if (maxOp.startsWith('<')) {
          // shrink
          return [
            ...accum,
            parsedBranch !== branch
              ? `${branch} <=${toVersion}`
              : parsedBranch.replace(`${maxOp}${max}`, `<=${toVersion}`),
          ];
        }
      } else if (maxOp.startsWith('<')) {
        nearestRangeVer = max;
        nearestRangeOp = maxOp;
        nearestRangeBranch = parsedBranch;
        nearestRangeBranchIdx = idx;
      } else {
        isShrinked = true;
        return [...accum, toVersion];
      }
    }
    return [...accum, branch];
  }, []);

  if (isShrinked) {
    return resultBranches.join(' || ');
  }

  if (
    nearestRangeVer &&
    maxVersion &&
    compare(nearestRangeVer, maxVersion) === -1
  ) {
    nearestRangeVer = null;
  }

  if (nearestRangeVer) {
    resultBranches[nearestRangeBranchIdx] = nearestRangeBranch.replace(
      `${nearestRangeOp}${nearestRangeVer}`,
      `<=${toVersion}`
    );
  }

  if (maxVersion) {
    resultBranches[maxVersionIdx] = maxVersion.startsWith('=')
      ? `=${toVersion}`
      : toVersion;
  }

  return resultBranches.join(' || ');
}

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  if (rangeStrategy === 'cap') {
    return cappedWithNewValue(currentValue, toVersion);
  }
  if (rangeStrategy === 'pin' || isVersion(currentValue)) {
    return toVersion;
  }
  if (rangeStrategy === 'update-lockfile') {
    if (satisfies(toVersion, currentValue)) {
      return currentValue;
    }
    return getNewValue(currentValue, 'replace', fromVersion, toVersion);
  }
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];
  if (rangeStrategy === 'widen') {
    const newValue = getNewValue(
      currentValue,
      'replace',
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
  const toVersionMajor = major(toVersion);
  const toVersionMinor = minor(toVersion);
  const toVersionPatch = patch(toVersion);
  const suffix = prerelease(toVersion) ? '-' + prerelease(toVersion)[0] : '';
  // Simple range
  if (rangeStrategy === 'bump') {
    if (parsedRange.length === 1) {
      if (!element.operator) {
        return getNewValue(currentValue, 'replace', fromVersion, toVersion);
      }
      if (element.operator === '^') {
        const split = currentValue.split('.');
        if (suffix.length) {
          return `^${toVersion}`;
        }
        if (split.length === 1) {
          // ^4
          return '^' + toVersionMajor;
        }
        if (split.length === 2) {
          // ^4.1
          return '^' + toVersionMajor + '.' + toVersionMinor;
        }
        return `^${toVersion}`;
      }
      if (element.operator === '~') {
        const split = currentValue.split('.');
        if (suffix.length) {
          return `~${toVersion}`;
        }
        if (split.length === 1) {
          // ~4
          return '~' + toVersionMajor;
        }
        if (split.length === 2) {
          // ~4.1
          return '~' + toVersionMajor + '.' + toVersionMinor;
        }
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
    logger.debug(
      'Unsupported range type for rangeStrategy=bump: ' + currentValue
    );
    return null;
  }
  if (element.operator === '~>') {
    return `~> ${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '^') {
    if (suffix.length || !fromVersion) {
      return `^${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
    }
    if (toVersionMajor === major(fromVersion)) {
      if (toVersionMajor === 0) {
        if (toVersionMinor === 0) {
          return `^${toVersion}`;
        }
        return `^${toVersionMajor}.${toVersionMinor}.0`;
      }
      return `^${toVersion}`;
    }
    return `^${toVersionMajor}.0.0`;
  }
  if (element.operator === '=') {
    return `=${toVersion}`;
  }
  if (element.operator === '~') {
    if (suffix.length) {
      return `~${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
    }
    return `~${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '<=') {
    let res;
    if (element.patch || suffix.length) {
      res = `<=${toVersion}`;
    } else if (element.minor) {
      res = `<=${toVersionMajor}.${toVersionMinor}`;
    } else {
      res = `<=${toVersionMajor}`;
    }
    if (currentValue.includes('<= ')) {
      res = res.replace('<=', '<= ');
    }
    return res;
  }
  if (element.operator === '<') {
    let res;
    if (currentValue.endsWith('.0.0')) {
      const newMajor = toVersionMajor + 1;
      res = `<${newMajor}.0.0`;
    } else if (element.patch) {
      res = `<${increment(toVersion, 'patch')}`;
    } else if (element.minor) {
      res = `<${toVersionMajor}.${toVersionMinor + 1}`;
    } else {
      res = `<${toVersionMajor + 1}`;
    }
    if (currentValue.includes('< ')) {
      res = res.replace('<', '< ');
    }
    return res;
  }
  if (!element.operator) {
    if (element.minor) {
      if (element.minor === 'x') {
        return `${toVersionMajor}.x`;
      }
      if (element.minor === '*') {
        return `${toVersionMajor}.*`;
      }
      if (element.patch === 'x') {
        return `${toVersionMajor}.${toVersionMinor}.x`;
      }
      if (element.patch === '*') {
        return `${toVersionMajor}.${toVersionMinor}.*`;
      }
      return `${toVersionMajor}.${toVersionMinor}`;
    }
    return `${toVersionMajor}`;
  }
  return toVersion;
}
