Alpine Package Keeper (apk) versioning is used for packages served from [APK repositories](https://wiki.alpinelinux.org/wiki/Repositories) such as the official Alpine Linux repositories or the [Wolfi APK package repository](https://packages.wolfi.dev/os)

This implementation follows the [Alpine Linux Package versions](https://wiki.alpinelinux.org/wiki/Package_policies#Package_versions) for version formatting.

Versions are similar to other Linux distributions, e.g. 3.2.1-r0

- The first segment follows semantic versioning
- Alpha, release candidates (\_rc2), etc are prefixed with an underscore, not a hyphen.
- Subsequent package versions are -r0, -r1, and so on; the number is from $pkgver.
- Subsequent package fixes are \_p0, \_p1 (typically seen if not using major.minor.patch, e.g. 6.5_p20250503-r0)

### Version Format Examples

- `2.39.0-r0` - Standard version with release number
- `2.39.0_rc1-r0` - Release candidate (pre-release)
- `6.5_p20250503-r0` - Package fix with date-based patch
- `2.39.0~beta-r0` - Beta pre-release

### Pre-release Handling

- `_rc` patterns (e.g., `_rc1`, `_rc2`) are treated as pre-release identifiers
- `_p` patterns (e.g., `_p20250503`) are treated as part of the version number
- `~` patterns (e.g., `~beta`) are treated as pre-release identifiers

Ranges are not supported by this versioning.
