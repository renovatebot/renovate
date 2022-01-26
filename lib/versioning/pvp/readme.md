# PVP

**What type of versioning is used?**

> A package version number SHOULD have the form A.B.C, and MAY optionally have any number of additional components, for example 2.1.0.4 (in this case, A=2, B=1, C=0).
> A.B is known as the major version number, and C the minor version number.
> Specification: https://pvp.haskell.org/

The one unusual difference between PVP and semver is that there are 2 major versions, and that
there could be additional version numbers past patch.

**Are ranges supported?**

Currently this is not supported but you can have ranges.
This implementation just supports updating extra-deps in the stack build tool which does not support ranges.
If this is used for cabal then it would be useful to support ranges.

**Are commit hashes supported?**

No.
