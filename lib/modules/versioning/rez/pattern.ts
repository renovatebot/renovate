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

import { regEx } from '../../../util/regex';

// - Replace single \ -> double \
export const versionGroup = '([0-9a-zA-Z_]+(?:[.-][0-9a-zA-Z_]+)*)';
export const matchVersion = regEx(
  `^(?<version>${versionGroup})$`,
); /* Match a version number (e.g. 1.0.0) */
export const exactVersion = regEx(
  `^(?<exact_version>==(?<exact_version_group>${versionGroup})?)$`,
); /* Match an exact version number (e.g. ==1.0.0) */
// inclusiveBound is called inclusive but behavior in rez is this:
// package-1..3 will match versions 1.2.3, 2.3.4, but not 3.0.0 or above
export const inclusiveBound = regEx(
  `^(?<inclusive_bound>(?<inclusive_lower_version>${versionGroup})?\\.\\.(?<inclusive_upper_version>${versionGroup})?)$`,
); /* Match an inclusive bound (e.g. 1.0.0..2.0.0) */
// Add ? after |\\+) in order to match >=1.15
export const lowerBound = new RegExp( // TODO #12872 named backreference
  `^(?<lower_bound>(?<lower_bound_prefix>>|>=)?(?<lower_version>${versionGroup})?(\\k<lower_bound_prefix>|\\+)?)$`,
); /* Match a lower bound (e.g. 1.0.0+) */
export const upperBound = new RegExp( // TODO #12872  lookahead
  `^(?<upper_bound>(?<upper_bound_prefix><(?=${versionGroup})|<=)?(?<upper_version>${versionGroup})?)$`,
); /* Match an upper bound (e.g. <=1.0.0) */
// Add ,? to match >=7,<9 (otherwise it just matches >=7<9)
export const ascendingRange = new RegExp( // TODO #12872  named backreference
  `^(?<range_asc>(?<range_lower_asc>(?<range_lower_asc_prefix>>|>=)?(?<range_lower_asc_version>${versionGroup})?(\\k<range_lower_asc_prefix>|\\+)?),?(?<range_upper_asc>(\\k<range_lower_asc_version>,?|)(?<range_upper_asc_prefix><(?=${versionGroup})|<=)(?<range_upper_asc_version>${versionGroup})?))$`,
); /* Match a range in ascending order (e.g. 1.0.0+<2.0.0) */
// Add , to match <9,>=7 (otherwise it just matches <9>=7)
export const descendingRange = new RegExp( // TODO #12872  named backreference
  `^(?<range_desc>(?<range_upper_desc>(?<range_upper_desc_prefix><|<=)?(?<range_upper_desc_version>${versionGroup})?(\\k<range_upper_desc_prefix>|\\+)?),(?<range_lower_desc>(\\k<range_upper_desc_version>,|)(?<range_lower_desc_prefix><(?=${versionGroup})|>=?)(?<range_lower_desc_version>${versionGroup})?))$`,
); /* Match a range in descending order (e.g. <=2.0.0,1.0.0+) */
