Alpine Package Keeper (APK) versioning is used for packages served from [APK repositories](https://wiki.alpinelinux.org/wiki/Repositories), such as the official Alpine Linux repositories or the [Wolfi APK package repository](https://packages.wolfi.dev/os)

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

### Version constraints

Constraints follow [`apk-world(5)`](https://gitlab.alpinelinux.org/alpine/apk-tools/-/blob/master/doc/apk-world.5.scd), which builds the operator from its characters, so the characters may be given in any order and may repeat.
This means `~`, `=~` and `~=` all mean the same thing.

| Operator | Meaning                      |
| -------- | ---------------------------- |
| _(none)_ | exact version                |
| `=`      | exact version                |
| `<`      | less than                    |
| `<=`     | less than or equal           |
| `>`      | greater than                 |
| `>=`     | greater than or equal        |
| `~`      | prefix match                 |
| `>~`     | greater than or prefix match |
| `<~`     | less than or prefix match    |

A prefix match compares token by token rather than by string, so `~1.6` matches `1.6`, `1.6.0_pre1`, `1.6.0`, `1.6.5` and `1.6.9_p1`, but not `1.60`.
Because a revision is a token of its own, `~8.12.1` matches every `8.12.1-rN`, which is how Wolfi and Chainguard images commonly pin their packages.

Renovate keeps the precision a prefix constraint was written with, so `~8.12.1` becomes `~8.13.0` rather than `~8.13.0-r0`, and `~8.12` becomes `~8.13`.

Renovate does not propose a replacement for the `<`, `<=`, `>`, `>=`, `>~` and `<~` operators, as there is no single obvious new bound for them.
The `><` operator constrains a package to an identity hash rather than to a version, so it is not a version constraint Renovate can resolve.
