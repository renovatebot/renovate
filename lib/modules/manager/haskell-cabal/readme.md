Supports dependency extraction from `build-depends` fields in [Cabal package description files](https://cabal.readthedocs.io/en/3.12/cabal-package-description-file.html#pkg-field-build-depends).
They use the extension `.cabal`, and are used with the [Haskell programming language](https://www.haskell.org/).

Limitations:

- The dependencies of all components are mushed together in one big list.
- Fields like `pkgconfig-depends` and `build-tool-depends` are not handled.
- The default PVP versioning is [subject to limitations](../../versioning/pvp/index.md).

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
