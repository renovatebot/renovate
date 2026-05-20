Renovate vcpkg versioning targets the per-port version schemes used by the [vcpkg package manager](https://learn.microsoft.com/vcpkg/users/versioning).

A vcpkg port declares one of four version fields, and Renovate dispatches the comparison logic according to which field is in use:

- `version` is a relaxed dotted-number scheme that allows extra components, like `3.1.4` or `1.2.3.4`
- `version-semver` is strict [Semantic Versioning](https://semver.org), like `3.1.4-rc.1`
- `version-date` is an ISO calendar date in `YYYY-MM-DD` form, optionally followed by dot-separated disambiguation identifiers like `2024-01-15.1.2`
- `version-string` is opaque text without a defined ordering, like `bla-bla-2024-08-fixed-typo`

Renovate detects which scheme applies by inspecting the input, then delegates to the matching underlying versioning module (`semver`, `loose`, or a direct date comparison).

A vcpkg port can also carry a `port-version` integer for changes that affect packaging without changing the upstream source.
The canonical text form combines the base version and port-version with a `#` separator, like `1.2.3#1`, and the port-version is omitted when zero.
Renovate treats the port-version as a tie-breaker after the base versions compare equal, so `1.2.3#1` is greater than `1.2.3#0`, while `1.2.4` is still greater than `1.2.3#1` because the base version wins.

Vcpkg has no range expression syntax. Manifest `dependencies` carry a single `version>=` lower bound, and `overrides` carry an exact pin. Renovate treats `matches` as a `>=` comparison for the numeric and date schemes, so any candidate version at or above the constraint satisfies. Opaque strings have no ordering on the base, so only versions with the same base satisfy, with port-version still providing the `>=` comparison once the base matches.
