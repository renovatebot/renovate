# PVP

**What type of versioning is used?**

Quotes from the [Haskell PVP Specification](https://pvp.haskell.org/):

> A package version number **SHOULD** have the form A.B.C, and **MAY** optionally have any number of additional components, for example 2.1.0.4 (in this case, A=2, B=1, C=0).

> A.B is known as the _major_ version number, and C the _minor_ version number.

The one unusual difference between PVP and SemVer is that there are two major versions, and that there can be an optional number of additional version numbers past _minor_.
For example `1.2.3` (note there's no _patch_ version here), `1.2.3.4` (`4` is the _patch_ version), or `1.2.3.4.5.6.7` are all valid version numbers.

**Are ranges supported?**

Currently this is not supported but you can have ranges.
This implementation just supports updating extra-deps in the Stack build tool which does not support ranges.
If this is used for Cabal then it would be useful to support ranges.

**Are commit hashes supported?**

No.
