Renovate's `semver-extended` versioning works like [Semantic Versioning 2.0](https://semver.org) and a subset of npm ranges, but allows three to ten numeric release parts, for example `27.3.4.19` or `0.6.0.1`.

A version has this format:

- an optional `v` or `V` prefix
- three to ten numeric parts, separated by dots
- an optional prerelease, like `-beta.1`, following the SemVer 2.0 rules
- optional build metadata, like `+build.5`, which is ignored when comparing versions

Anything else is not a valid version.

Release parts may have leading zeros, which are ignored when comparing, so `01.2.3` equals `1.2.3`.
Numeric prerelease identifiers may not have leading zeros, so `1.2.3-01` is not a valid version.
Missing release parts count as zero when comparing versions of different lengths, so `1.2.3` equals `1.2.3.0`.
The first three parts are the major, minor and patch parts.
Unlike `semver-coerced`, which coerced `26.2.5.3` to `26.2.5`, all parts are compared, so `<=26.2.5` doesn't match `26.2.5.3` and `>26.2.5` does.

Like `semver`, an update counts as breaking when either version has a prerelease, when the current first part is `0`, or when the first part changes, so `0.6.0.1` to `0.7.0.0` is breaking and `27.3.4.19` to `27.3.4.20` is not.

Prereleases are ordered like in SemVer 2.0: a version with a prerelease is lower than the same version without one, and prerelease identifiers are compared one by one, numeric identifiers numerically and others in ASCII order.

Ranges use a subset of the npm syntax: comparators, exact and partial versions, hyphen ranges and `||`.
There is no `=` or `==` operator, an exact version is written bare, like `1.2.3.4`.
The `^`, `~` and `~>` operators aren't supported either: write `^26` as `26` and `^26.2.1` as `>=26.2.1 <27`.

| Range                   | Meaning                                        |
| ----------------------- | ---------------------------------------------- |
| `1.2.3.4`               | exactly `1.2.3.4`                              |
| `>1.2.3.4`, `<=1.2.3.4` | comparators `<`, `<=`, `>`, `>=`               |
| `>=1.2.3.4 <1.3.0`      | comparators separated by spaces must all match |
| `>= 1.2.3.4`            | spaces are allowed after an operator           |
| `1.x \|\| 2.x`          | `\|\|` separates alternatives                  |
| `1.2.3.4 - 2.3.4.5`     | `>=1.2.3.4 <=2.3.4.5`                          |
| `1.2.3 - 2.3`           | `>=1.2.3 <2.4.0-0`                             |
| `1.2`, `1.2.x`, `1.2.*` | `>=1.2.0 <1.3.0-0`                             |
| `1`, `1.x`              | `>=1.0.0 <2.0.0-0`                             |
| `1.2.3.x`               | `>=1.2.3 <1.2.4-0`                             |
| `>1.2`                  | `>=1.3.0`                                      |
| `<1.2`                  | `<1.2.0-0`                                     |
| `<=1.2`                 | `<1.3.0-0`                                     |

A value with fewer than three parts, or with a wildcard `x`, `X` or `*`, is a partial version: everything after the first wildcard is ignored, and it can't have a prerelease or build metadata.
The first part must be a number, so wildcard-only ranges like `*`, `x`, `<*` or `* - 2.0.0` are not supported.
Like in npm, the upper bounds generated for partial versions end in `-0`, so they also exclude the prereleases of the bound.

A prerelease version only matches a range if a comparator of the same alternative has a prerelease with the same release parts, so `1.2.3.4-rc.2` matches `>=1.2.3.4-rc.1` but `1.2.4-rc.1` does not.

This versioning supports the `bump`, `pin`, `replace` and `widen` range strategies.
Updated ranges keep their operators and `v` prefixes.
`replace` and `widen` keep the number of parts of partial versions.
`bump` keeps it for bare values and x-ranges, but writes the full new version for `>=` and the lower bound of a hyphen range.
An exact version is always written bare, like `1.2.3.4`:

| Range               | Strategy  | New version  | Result                |
| ------------------- | --------- | ------------ | --------------------- |
| `>=0.6.0.1 <0.7`    | `bump`    | `0.7.0.2`    | `>=0.7.0.2 <0.8`      |
| `>=0.6.0.1 <0.7`    | `replace` | `0.7.0.2`    | `>=0.6.0.1 <0.8`      |
| `>=27.3.4.19 <27.4` | `bump`    | `27.3.4.20`  | `>=27.3.4.20 <27.4`   |
| `>=27.3.4.19 <27.4` | `replace` | `27.3.4.20`  | `>=27.3.4.19 <27.4`   |
| `27.3`              | `replace` | `27.4.1.0`   | `27.4`                |
| `1.x`               | `replace` | `2.1.0.0`    | `2.x`                 |
| `>=1.2.3.4`         | `bump`    | `1.2.3.5`    | `>=1.2.3.5`           |
| `<2.0`              | `replace` | `2.1.0`      | `<2.2`                |
| `<2.0.0`            | `replace` | `2.1.0`      | `<3.0.0`              |
| `<2.1.0`            | `replace` | `2.3.5`      | `<2.4.0`              |
| `<1.2.3.4.5`        | `replace` | `1.2.4`      | `<1.2.4.0.1`          |
| `>=0.6.0.1 <0.7`    | `widen`   | `0.7.0.2`    | `>=0.6.0.1 <0.8`      |
| `1 \|\| 2`          | `widen`   | `3.0.0.1`    | `1 \|\| 2 \|\| 3`     |
| `1.x`               | `widen`   | `1.5.0-beta` | `1.x \|\| 1.5.0-beta` |

`replace` keeps a range that already matches the new version, and otherwise replaces the comparators that don't match.
Each comparator is checked against the new version by version order alone, so a comparator the version satisfies is kept even when the range as a whole doesn't match the prerelease: `replace` leaves `<2.0.0` unchanged for `1.5.0-rc.1`.
For a prerelease new version, a replaced partial value gets the full new version, so `1.2` becomes `1.5.0-beta` and `1.x` becomes `2.0.0-beta`.
When the replaced range still doesn't match a prerelease new version, `replace` uses the `bump` result instead, so `>=1.0.0 <2` with `2.0.0-beta` becomes `>=2.0.0-beta <3`.
A `<` bound becomes the new version, zero-filled and cut to the bound's number of parts.
A partial bound then raises its last part by one, and a full bound raises the part at the position of its last non-zero part by one and sets the parts after it to zero.
`bump` moves the lower bounds to the new version and keeps upper bounds that still match.
With `||`, `bump` updates the alternatives that match the new version, and when none matches both strategies replace the range with the updated last alternative.
Alternatives that aren't updated keep their original text, including the spacing around `||`.
`replace` returns no update when a `>` comparator doesn't match the new version.
`bump` returns no update when the alternative it updates has a `>` comparator, even if that comparator matches.
`widen` keeps a range that already matches the new version.
A prerelease or a new version below the range is appended as an exact version with `||`, so `>=1.2.3.4` with `1.2.3.3` becomes `>=1.2.3.4 || 1.2.3.3` and `1.0.0 - 2.0.0` with `2.1.0-beta` becomes `1.0.0 - 2.0.0 || 2.1.0-beta`.
Otherwise, when the last alternative ends with a `<` or `<=` bound or is a hyphen range, it widens that alternative in place, and else it appends the replaced last alternative with `||`.
These rules only look at the last alternative.
Like `replace`, `widen` returns no update when a `>` comparator of the last alternative doesn't match the new version, and also when the last alternative has several comparators and ends with `>` or `>=`.
Both exceptions don't apply when the new version is below the range or is a prerelease, because then it is appended as an exact version: `>=1.0.0 >1.5.0` with `2.0.0-rc.1` becomes `>=1.0.0 >1.5.0 || 2.0.0-rc.1`.
A `>` comparator in an earlier alternative doesn't matter, so `>5 || 1.x` with `3.0.0` becomes `>5 || 1.x || 3.x`.
