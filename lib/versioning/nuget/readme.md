# NuGet versioning

## Documentation and URLs

https://docs.microsoft.com/en-us/nuget/concepts/package-versioning

The intention of this version scheme is to match as closely as possible the version comparison that NuGet itself uses.

## What type of versioning is used?

NuGet supports SemVer 2.0.0, but permits versions with differing numbers of version parts.

## Are ranges supported? How?

Ranges are not yet supported by this version scheme, but they are defined in NuGet and could be supported in the future.

## Range Strategy support

Not yet implemented.

## Implementation plan/status

- [x] Best effort parsing and sorting
- [ ] Range support
