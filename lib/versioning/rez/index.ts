import { api as npm } from '../npm';
import { api as pep440 } from '../pep440';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'rez';
export const displayName = 'rez';
export const urls = ['https://github.com/nerdvegas/rez'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

// Regular Expressions have been copied from, some more work were necessary to make it work:

// original rez regex written in python (#11634)
// version_range_regex = (
//     # Match a version number (e.g. 1.0.0)
//     r"   ^(?P<version>{version_group})$"
//     "|"
//     # Or match an exact version number (e.g. ==1.0.0)
//     "    ^(?P<exact_version>"
//     "        =="  # Required == operator
//     "        (?P<exact_version_group>{version_group})?"
//     "    )$"
//     "|"
//     # Or match an inclusive bound (e.g. 1.0.0..2.0.0)
//     "    ^(?P<inclusive_bound>"
//     "        (?P<inclusive_lower_version>{version_group})?"
//     "        \.\."  # Required .. operator
//     "        (?P<inclusive_upper_version>{version_group})?"
//     "    )$"
//     "|"
//     # Or match a lower bound (e.g. 1.0.0+)
//     "    ^(?P<lower_bound>"
//     "        (?P<lower_bound_prefix>>|>=)?"  # Bound is exclusive?
//     "        (?P<lower_version>{version_group})?"
//     "        (?(lower_bound_prefix)|\+)"  # + only if bound is not exclusive
//     "    )$"
//     "|"
//     # Or match an upper bound (e.g. <=1.0.0)
//     "    ^(?P<upper_bound>"
//     "        (?P<upper_bound_prefix><(?={version_group})|<=)?"  # Bound is exclusive?
//     "        (?P<upper_version>{version_group})?"
//     "    )$"
//     "|"
//     # Or match a range in ascending order (e.g. 1.0.0+<2.0.0)
//     "    ^(?P<range_asc>"
//     "        (?P<range_lower_asc>"
//     "           (?P<range_lower_asc_prefix>>|>=)?"  # Lower bound is exclusive?
//     "           (?P<range_lower_asc_version>{version_group})?"
//     "           (?(range_lower_asc_prefix)|\+)?"  # + only if lower bound is not exclusive
//     "       )(?P<range_upper_asc>"
//     "           (?(range_lower_asc_version),?|)"  # , only if lower bound is found
//     "           (?P<range_upper_asc_prefix><(?={version_group})|<=)"  # <= only if followed by a version group
//     "           (?P<range_upper_asc_version>{version_group})?"
//     "       )"
//     "    )$"
//     "|"
//     # Or match a range in descending order (e.g. <=2.0.0,1.0.0+)
//     "    ^(?P<range_desc>"
//     "        (?P<range_upper_desc>"
//     "           (?P<range_upper_desc_prefix><|<=)?"  # Upper bound is exclusive?
//     "           (?P<range_upper_desc_version>{version_group})?"
//     "           (?(range_upper_desc_prefix)|\+)?"  # + only if upper bound is not exclusive
//     "       )(?P<range_lower_desc>"
//     "           (?(range_upper_desc_version),|)"  # Comma is not optional because we don't want to recognize something like "<4>3"
//     "           (?P<range_lower_desc_prefix><(?={version_group})|>=?)"  # >= or > only if followed by a version group
//     "           (?P<range_lower_desc_version>{version_group})?"
//     "       )"
//     "    )$"
// ).format(version_group=version_group)

// - Replace {version_group} -> ${versionGroup}
// - Replace (?P<...>) -> (?<...>)
// - Replace ?(...) -> \k<...>
// - Replace single \ -> double \
const versionGroup = '([0-9a-zA-Z_]+(?:[.-][0-9a-zA-Z_]+)*)';
const matchVersion = new RegExp(
  `^(?<version>${versionGroup})$`
); /* Match a version number (e.g. 1.0.0) */
const exactVersion = new RegExp(
  `^(?<exact_version>==(?<exact_version_group>${versionGroup})?)$`
); /* Match an exact version number (e.g. ==1.0.0) */
// inclusiveBound is called inclusive but behaviour in rez is this:
// package-1..3 will match versions 1.2.3, 2.3.4, but not 3.0.0 or above
const inclusiveBound = new RegExp(
  `^(?<inclusive_bound>(?<inclusive_lower_version>${versionGroup})?\\.\\.(?<inclusive_upper_version>${versionGroup})?)$`
); /* Match an inclusive bound (e.g. 1.0.0..2.0.0) */
// Add ? after |\\+) in order to match >=1.15
const lowerBound = new RegExp(
  `^(?<lower_bound>(?<lower_bound_prefix>>|>=)?(?<lower_version>${versionGroup})?(\\k<lower_bound_prefix>|\\+)?)$`
); /* Match a lower bound (e.g. 1.0.0+) */
const upperBound = new RegExp(
  `^(?<upper_bound>(?<upper_bound_prefix><(?=${versionGroup})|<=)?(?<upper_version>${versionGroup})?)$`
); /* Match an upper bound (e.g. <=1.0.0) */
// Add ,? to match >=7,<9 (otherwise it just matches >=7<9)
const ascendingRange = new RegExp(
  `^(?<range_asc>(?<range_lower_asc>(?<range_lower_asc_prefix>>|>=)?(?<range_lower_asc_version>${versionGroup})?(\\k<range_lower_asc_prefix>|\\+)?),?(?<range_upper_asc>(\\k<range_lower_asc_version>,?|)(?<range_upper_asc_prefix><(?=${versionGroup})|<=)(?<range_upper_asc_version>${versionGroup})?))$`
); /* Match a range in ascending order (e.g. 1.0.0+<2.0.0) */
// Add , to match <9,>=7 (otherwise it just matches <9>=7)
const descendingRange = new RegExp(
  `^(?<range_desc>(?<range_upper_desc>(?<range_upper_desc_prefix><|<=)?(?<range_upper_desc_version>${versionGroup})?(\\k<range_upper_desc_prefix>|\\+)?),(?<range_lower_desc>(\\k<range_upper_desc_version>,|)(?<range_lower_desc_prefix><(?=${versionGroup})|>=?)(?<range_lower_desc_version>${versionGroup})?))$`
); /* Match a range in descending order (e.g. <=2.0.0,1.0.0+) */

function getVersionParts(input: string): [string, string] {
  const versionParts = input.split('-');
  if (versionParts.length === 1) {
    return [input, ''];
  }

  return [versionParts[0], '-' + versionParts[1]];
}

function padZeroes(input: string): string {
  if (/[~^*]/.test(input)) {
    // ignore ranges
    return input;
  }

  const [output, stability] = getVersionParts(input);

  const sections = output.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.') + stability;
}

function plus2npm(input: string): string {
  if (input.includes('+')) {
    return '>=' + input.replace('+', ' ');
  }
  return input;
}

function rez2npm(input: string): string {
  if (matchVersion.test(input)) {
    return input;
  }
  if (exactVersion.test(input)) {
    return input.replace('==', '=');
  }
  if (inclusiveBound.test(input)) {
    return '>=' + input.replace('..', ' <');
  }
  if (lowerBound.test(input)) {
    return plus2npm(input);
  }
  if (upperBound.test(input)) {
    return input;
  }
  if (ascendingRange.test(input)) {
    const match = ascendingRange.exec(input);
    const lowerBoundAsc = match.groups.range_lower_asc;
    const upperBoundAsc = match.groups.range_upper_asc;
    return plus2npm(lowerBoundAsc) + ' ' + plus2npm(upperBoundAsc);
  }
  if (descendingRange.test(input)) {
    const match = descendingRange.exec(input);
    const upperBoundDesc = match.groups.range_upper_desc;
    const lowerBoundDesc = match.groups.range_lower_desc;
    return plus2npm(lowerBoundDesc) + ' ' + plus2npm(upperBoundDesc);
  }
  return input;
}

function rez2pep440(input: string): string {
  if (matchVersion.test(input)) {
    return input;
  }
  if (exactVersion.test(input)) {
    return input;
  }
  if (inclusiveBound.test(input)) {
    return '>=' + input.replace('..', ', <');
  }
  if (lowerBound.test(input)) {
    return plus2npm(input);
  }
  if (upperBound.test(input)) {
    return input;
  }
  if (ascendingRange.test(input)) {
    const match = ascendingRange.exec(input);
    const lowerBoundAsc = match.groups.range_lower_asc;
    const upperBoundAsc = match.groups.range_upper_asc;
    return plus2npm(lowerBoundAsc) + ', ' + plus2npm(upperBoundAsc);
  }
  if (descendingRange.test(input)) {
    const match = descendingRange.exec(input);
    const upperBoundDesc = match.groups.range_upper_desc;
    const lowerBoundDesc = match.groups.range_lower_desc;
    return plus2npm(lowerBoundDesc) + ', ' + plus2npm(upperBoundDesc);
  }
  return input;
}

function pep4402rezInclusiveBound(input: string): string {
  return input
    .split(',')
    .map((v) => v.trim().replace(/[<>=]/g, ''))
    .join('..');
}

function npm2rezplus(input: string): string {
  return input.trim().replace('>=', '') + '+';
}

const equals = (a: string, b: string): boolean => {
  try {
    return npm.equals(padZeroes(a), padZeroes(b));
  } catch (err) /* istanbul ignore next */ {
    return pep440.equals(a, b);
  }
};

const getMajor = (version: string): number => {
  try {
    return npm.getMajor(padZeroes(version));
  } catch (err) /* istanbul ignore next */ {
    return pep440.getMajor(version);
  }
};

const getMinor = (version: string): number => {
  try {
    return npm.getMinor(padZeroes(version));
  } catch (err) /* istanbul ignore next */ {
    return pep440.getMinor(version);
  }
};

const getPatch = (version: string): number => {
  try {
    return npm.getPatch(padZeroes(version));
  } catch (err) /* istanbul ignore next */ {
    return pep440.getPatch(version);
  }
};

const isGreaterThan = (a: string, b: string): boolean => {
  try {
    return npm.isGreaterThan(padZeroes(a), padZeroes(b));
  } catch (err) /* istanbul ignore next */ {
    return pep440.isGreaterThan(a, b);
  }
};

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isVersion(padZeroes(version)) &&
  npm.isLessThanRange(padZeroes(version), rez2npm(range));

export const isValid = (input: string): string | boolean =>
  npm.isValid(rez2npm(input));

const isStable = (version: string): boolean => npm.isStable(padZeroes(version));

const isVersion = (input: string): string | boolean =>
  npm.isVersion(padZeroes(rez2npm(input)));

const matches = (version: string, range: string): boolean =>
  npm.isVersion(padZeroes(version)) &&
  npm.matches(padZeroes(version), rez2npm(range));

const getSatisfyingVersion = (versions: string[], range: string): string =>
  npm.getSatisfyingVersion(versions, rez2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions, rez2npm(range));

const isSingleVersion = (constraint: string): string | boolean =>
  (constraint.trim().startsWith('==') &&
    isVersion(constraint.trim().substring(2).trim())) ||
  isVersion(constraint.trim());

function sortVersions(a: string, b: string): number {
  return npm.sortVersions(padZeroes(a), padZeroes(b));
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  const pep440Value = pep440.getNewValue({
    currentValue: rez2pep440(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (exactVersion.test(currentValue)) {
    return pep440Value;
  }
  if (inclusiveBound.test(currentValue)) {
    return pep4402rezInclusiveBound(pep440Value);
  }
  if (lowerBound.test(currentValue)) {
    if (currentValue.includes('+')) {
      return npm2rezplus(pep440Value);
    }
    return pep440Value;
  }
  if (upperBound.test(currentValue)) {
    return pep440Value;
  }
  if (ascendingRange.test(currentValue)) {
    // Replace version numbers but keep rez format, otherwise we just end up trying
    // to convert every single case separately.
    const match = ascendingRange.exec(currentValue);
    const lowerBoundAscCurrent = match.groups.range_lower_asc;
    const upperBoundAscCurrent = match.groups.range_upper_asc;
    const lowerAscVersionCurrent = match.groups.range_lower_asc_version;
    const upperAscVersionCurrent = match.groups.range_upper_asc_version;
    const [lowerBoundAscPep440, upperBoundAscPep440] = pep440Value.split(', ');
    const lowerAscVersionNew = new RegExp(versionGroup).exec(
      lowerBoundAscPep440
    )[0];
    const upperAscVersionNew = new RegExp(versionGroup).exec(
      upperBoundAscPep440
    )[0];
    const lowerBoundAscNew = lowerBoundAscCurrent.replace(
      lowerAscVersionCurrent,
      lowerAscVersionNew
    );
    const upperBoundAscNew = upperBoundAscCurrent.replace(
      upperAscVersionCurrent,
      upperAscVersionNew
    );
    const separator = currentValue.includes(',') ? ',' : '';

    return lowerBoundAscNew + separator + upperBoundAscNew;
  }
  if (descendingRange.test(currentValue)) {
    // Replace version numbers but keep rez format, otherwise we just end up trying
    // to convert every single case separately.
    const match = descendingRange.exec(currentValue);
    const upperBoundDescCurrent = match.groups.range_upper_desc;
    const lowerBoundDescCurrent = match.groups.range_lower_desc;
    const upperDescVersionCurrent = match.groups.range_upper_desc_version;
    const lowerDescVersionCurrent = match.groups.range_lower_desc_version;
    const [lowerBoundDescPep440, upperBoundDescPep440] =
      pep440Value.split(', ');

    const upperDescVersionNew = new RegExp(versionGroup).exec(
      upperBoundDescPep440
    )[0];
    const lowerDescVersionNew = new RegExp(versionGroup).exec(
      lowerBoundDescPep440
    )[0];
    const upperBoundDescNew = upperBoundDescCurrent.replace(
      upperDescVersionCurrent,
      upperDescVersionNew
    );
    const lowerBoundDescNew = lowerBoundDescCurrent.replace(
      lowerDescVersionCurrent,
      lowerDescVersionNew
    );
    // Descending ranges are only supported with a comma.
    const separator = ',';

    return upperBoundDescNew + separator + lowerBoundDescNew;
  }
  return null;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  getNewValue,
  getSatisfyingVersion,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  minSatisfyingVersion,
  sortVersions,
};
export default api;
