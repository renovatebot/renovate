Renovate's 'Same Major' versioning is specifically designed to address scenarios where version specifications, denoted as X.Y.Z, signify a range of compatibility from greater than or equal to X.Y.Z to less than X+1.
In essence, each individual version is to be treated as a constraint.

This method is handy when managing dependencies like dotnet-sdk's rollForward settings.
Let's say a project uses dotnet-sdk version 3.1.0.
It needs to be compatible with any version in the 3.x.x range but not with versions in the next major version, like 4.x.x.

This process employs Semver-Coerced versioning beneath the surface, wherein single versions (e.g., `X.Y.Z`) are converted to a range like `X+1` and then passed to the corresponding semver-coerced method.
