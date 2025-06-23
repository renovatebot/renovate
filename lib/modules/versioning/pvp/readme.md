[Package Versioning Policy](https://pvp.haskell.org/) is used with Haskell.
It's like semver, except that the first _two_ parts are of the major
version. That is, in `A.B.C`:

- `A.B`: major version
- `C`: minor

The remaining parts are all considered of the patch version, and
they will be concatenated to form a `number`, i.e. IEEE 754 double. This means
that both `0.0.0.0.1` and `0.0.0.0.10` have patch version `0.1`.

The range syntax comes from Cabal, specifically the [build-depends
section](https://cabal.readthedocs.io/en/3.10/cabal-package.html).

This module is considered experimental since it only supports ranges of forms:

- `>=W.X && <Y.Z`
- `<Y.Z && >=W.X`
