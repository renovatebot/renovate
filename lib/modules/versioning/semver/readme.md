Renovate's `semver` versioning _strictly_ implements the [Semantic Versioning 2.0](https://semver.org) specification.
Because the SemVer 2.0 specification does _not_ allow ranges, Renovate's `semver` versioning also does _not_ support ranges.

Only use the `semver` versioning when you mean to follow the full SemVer 2.0 specifications strictly.
If you need a more forgiving variant use `semver-coerced`.
