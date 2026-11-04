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
