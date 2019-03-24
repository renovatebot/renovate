# Poetry versioning

## Documentation and URLs

https://poetry.eustace.io/docs/versions/

## What type of versioning is used?

Poetry uses [Semantic Versioning 2.0](https://semver.org).

## Are ranges supported? How?

Poetry supports ranges in a similar manner to npm, but not identical. The important differences are:

##### Use of commas

Multiple version requirements can be separated with a comma, e.g. `>= 1.2, < 1.5`. We interpret this to mean AND.

## Range Strategy support

Poetry versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Add poetry2npm and npm2poetry functions to leverage existing npm semver logic
- [x] Exact version support
- [x] Range support
