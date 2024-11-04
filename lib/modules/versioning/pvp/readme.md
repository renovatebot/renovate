[Package Versioning Policy](https://pvp.haskell.org/) is used with Haskell.
It's like semver, except that the first _two_ components are parts of the major
version. That is, in `A.B.C`:

- `A.B`: major version
- `C`: minor

The range syntax comes from Cabal, specifically the [build-depends
section](https://cabal.readthedocs.io/en/3.10/cabal-package.html).
