version_range_regex = (
    # Match a version number (e.g. 1.0.0)
    r"   ^(?P<version>{version_group})$"
    "|"
    # Or match an exact version number (e.g. ==1.0.0)
    "    ^(?P<exact_version>"
    "        =="  # Required == operator
    "        (?P<exact_version_group>{version_group})?"
    "    )$"
    "|"
    # Or match an inclusive bound (e.g. 1.0.0..2.0.0)
    "    ^(?P<inclusive_bound>"
    "        (?P<inclusive_lower_version>{version_group})?"
    "        \.\."  # Required .. operator
    "        (?P<inclusive_upper_version>{version_group})?"
    "    )$"
    "|"
    # Or match a lower bound (e.g. 1.0.0+)
    "    ^(?P<lower_bound>"
    "        (?P<lower_bound_prefix>>|>=)?"  # Bound is exclusive?
    "        (?P<lower_version>{version_group})?"
    "        (?(lower_bound_prefix)|\+)"  # + only if bound is not exclusive
    "    )$"
    "|"
    # Or match an upper bound (e.g. <=1.0.0)
    "    ^(?P<upper_bound>"
    "        (?P<upper_bound_prefix><(?={version_group})|<=)?"  # Bound is exclusive?
    "        (?P<upper_version>{version_group})?"
    "    )$"
    "|"
    # Or match a range in ascending order (e.g. 1.0.0+<2.0.0)
    "    ^(?P<range_asc>"
    "        (?P<range_lower_asc>"
    "           (?P<range_lower_asc_prefix>>|>=)?"  # Lower bound is exclusive?
    "           (?P<range_lower_asc_version>{version_group})?"
    "           (?(range_lower_asc_prefix)|\+)?"  # + only if lower bound is not exclusive
    "       )(?P<range_upper_asc>"
    "           (?(range_lower_asc_version),?|)"  # , only if lower bound is found
    "           (?P<range_upper_asc_prefix><(?={version_group})|<=)"  # <= only if followed by a version group
    "           (?P<range_upper_asc_version>{version_group})?"
    "       )"
    "    )$"
    "|"
    # Or match a range in descending order (e.g. <=2.0.0,1.0.0+)
    "    ^(?P<range_desc>"
    "        (?P<range_upper_desc>"
    "           (?P<range_upper_desc_prefix><|<=)?"  # Upper bound is exclusive?
    "           (?P<range_upper_desc_version>{version_group})?"
    "           (?(range_upper_desc_prefix)|\+)?"  # + only if upper bound is not exclusive
    "       )(?P<range_lower_desc>"
    "           (?(range_upper_desc_version),|)"  # Comma is not optional because we don't want to recognize something like "<4>3"
    "           (?P<range_lower_desc_prefix><(?={version_group})|>=?)"  # >= or > only if followed by a version group
    "           (?P<range_lower_desc_version>{version_group})?"
    "       )"
    "    )$"
).format(version_group=version_group)
