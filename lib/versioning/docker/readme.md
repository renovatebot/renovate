# Docker versioning

## Documentation and URLs

Docker doesn't really use _versioning_, but it supports "tags" and these are usually used by Docker image authors as a form of versioning.

This "versioning" implementation is essentially a creation of Renovate to handle the default _conventions_ used in tagging most images. In particular, it treats the text after the first hyphen as a type of platform/compatibility indicator.

For example, many images include images with the "-alpine" suffix, e.g. the offical `node` Docker image includes tags like `8.14.0-alpine` which is _not_ compatible with `8.14.0` or `8.14.0-stretch`. This means users only want/expect upgrades to `8.15.0-alpine` and not `8.15.0` or `8.15.0-stretch`.

Similarly, a user with `8.14` expects to be upgraded to `8.15` and not `8.15.0`.

## What type of versioning is used?

It's pretty "wild west" for tagging and not always compliant with semver. Docker versioning in Renovate should do a best effort to accept and sort semver-like versions.

## Are ranges supported? How?

Yes and no. In theory, a tag of `8.15` should be like `>=8.15.0 <8.16.0`. In practice, there is nothing that enforces that the latest `8.15` code matches exactly with the latest `8.15.x` tag. e.g. `8.15` may not be the same as `8.15.0`, but it usually should be. Also, `8.15` is technically a version and not a range.

## Range Strategy support

We may be able to "pin" from range-like tags like `8.15` to semver-like tags like `8.15.0` but we should probably work out a way to compare the sha256 hashes before pinning.

Otherwise, we can support "replace" strategy.

"Bump" strategy and "extend" strategies are not applicable.

## Implementation plan/status

- [x] Compatibility check between tag suffixes
- [x] Upgrade semver tags (e.g. `8.14.0` to `8.15.0`)
- [x] Upgrade range-like tags (e.g. `8.14` to `8.15`)
- [x] Allow non-semver-compatible leading zeroes, e.g. `16.04.0` to `16.04.1`
- [x] Support getDigest for pinning and updating tag digests
