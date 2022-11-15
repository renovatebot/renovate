Conan versioning supports [Semantic Versioning 2.0](https://semver.org) but some packages don't follow this specification.

Conan implements [python-node-semver](https://github.com/podhmo/python-node-semver).

Read the [Conan docs about version ranges](https://docs.conan.io/en/latest/versioning/version_ranges.html#version-ranges) for more information.

| syntax                                           | description                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `5.45`                                           | Equivalent to `5.45`                                                                                       |
| `16.00`                                          | Equivalent to `16.00`                                                                                      |
| `2.8.3`                                          | Equivalent to `2.8.3`                                                                                      |
| `[>1.1 <2.1]`                                    | Keep version within range                                                                                  |
| `[2.8]`                                          | Equivalent to `=2.8`                                                                                       |
| `[~=3.0]`                                        | Compatible, according to SemVer                                                                            |
| `[>1.1 \|\| 0.8]`                                | Conditions can be OR'ed                                                                                    |
| `[1.2.7 \|\| >=1.2.9 <2.0.0]`                    | This range would match the versions `1.2.7`, `1.2.9`, and `1.4.6`, but not the versions `1.2.8` or `2.0.0` |
| `[>1.1 <2.1, include_prerelease=True]`           | Would e.g. accept `2.0.0-pre.1` as match                                                                   |
| `[~1.2.3, loose=False]`                          | Would only accept correct Semantic Versioning strings. E.g. version `1.2.3.4` would not be accepted        |
| `[~1.2.3, loose=False, include_prerelease=True]` | Both options can be used for the same version range                                                        |
