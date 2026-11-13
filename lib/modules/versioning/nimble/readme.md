[Nimble](https://github.com/nim-lang/nimble) uses [Semantic Versioning 2.0](https://semver.org/) with Nimble-specific version range syntax defined in `nimblepkg/version.nim`:

| Constraint            | Meaning                                                                                               |
| :-------------------- | :---------------------------------------------------------------------------------------------------- |
| `1.2.3` or `== 1.2.3` | Exactly version `1.2.3`                                                                               |
| `>= 1.2.3`            | At least version `1.2.3`                                                                              |
| `> 1.2.3`             | Greater than version `1.2.3`                                                                          |
| `<= 1.2.3`            | At most version `1.2.3`                                                                               |
| `< 1.2.3`             | Less than version `1.2.3`                                                                             |
| `^= 1.2.3`            | SemVer caret constraint (`>= 1.2.3 & < 2.0.0`, or `>= 0.2.3 & < 0.3.0` for `0.x`)                     |
| `~= 1.2.3`            | Tilde constraint (`>= 1.2.3 & < 1.3.0` for 3-part versions, `>= 1.2.0 & < 2.0.0` for 2-part versions) |
| `>= 1.0.0 & < 2.0.0`  | Intersection of two bounds joined by `&`                                                              |

Git tags with a leading `v` or `V` prefix (such as `v1.2.3`) are accepted when matching and comparing releases, and the prefix is stripped when writing updated constraints into `.nimble` files.
