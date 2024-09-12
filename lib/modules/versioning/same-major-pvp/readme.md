This is like same-major, except that the first _two_ components are parts of the major version. That is, in `A.B.C.D`:
* `A.B`: major version
* `C`: minor
* `D`: 'patch' according to the PVP spec, but since Renovate doesn't support this category, it is also part of the minor.

Any additional components are also part of the minor version.
