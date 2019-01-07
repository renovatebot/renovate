# Cargo versioning

## Documentation and URLs

https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html

## What type of versioning is used?

Cargo uses [Semantic Versioning 2.0](https://semver.org).

## Are ranges supported? How?

Cargo supports ranges in a similar manner to npm, but not identical. The important differences are:

##### Use of commas

Multiple version requirements can also be separated with a comma, e.g. `>= 1.2, < 1.5`. We interpret this to mean AND.

##### No exact versions unless using equals =

In Cargo, `1.2.3` doesn't mean "exactly 1.2.3", it actually means `>=1.2.3 <2.0.0`. So this is like the equivalent of `^1.2.3` in npm.

## Range Strategy support

Cargo versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Add cargo2npm and npm2cargo functions to leverage existing npm semver logic
- [x] Exact version support
- [x] Range support
