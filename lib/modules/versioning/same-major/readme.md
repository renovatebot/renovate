The 'Same Major' versioning is designed to handle the case where a version needs to treated as a "greater than or equal to" constraint.
Specifically, the case where the version say, `X.Y.Z` signifies a range of compatibility from greater than or equal to `X.Y.Z` to less than `X+1`.

This process uses Semver-Coerced versioning beneath the surface, single versions (e.g., `X.Y.Z`) are converted to a range like `X+1` and then passed to the corresponding semver-coerced method.

This method is handy when managing dependencies like dotnet-sdk's rollForward settings.
Let's say a project uses dotnet-sdk version `3.1.0`.
It needs to be compatible with any version in the `3.x.x` range but _not_ with versions in the next major version, like `4.x.x`.

For example:

```json
{
  "sdk": {
    "version": "6.0.300",
    "rollForward": "major"
  }
}
```

The roll-forward policy to use when selecting an SDK version, either as a fallback when a specific SDK version is missing or as a directive to use a higher version. In this case with `major` it means that select the latest version with the same major.
ie. `>= 6.0.300 < 7.0.0`

For such cases, the users would not want Renovate to create an update PR for any version within the range `>= 6.0.300 < 7.0.0` as it would not change the behaviour on their end, since it is handled by the manager already.

Note:
You should create a discussion before using this versioning as this is an experimental support and might have some edge cases unhandled.
