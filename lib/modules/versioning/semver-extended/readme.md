Renovate's `semver-extended` versioning works like [Semantic Versioning 2.0](https://semver.org), but allows three to ten numeric release parts, for example `27.3.4.19` or `0.6.0.1`.

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

This versioning does not support ranges.
