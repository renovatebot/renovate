# Composer versioning

## Documentation and URLs

https://getcomposer.org/doc/articles/versions.md
https://packagist.org/packages/composer/semver
https://madewithlove.be/tilde-and-caret-constraints/
https://semver.mwl.be

## What type of versioning is used?

Composer uses Semver-like versioning, however some package authors may use versions that are not completely valid, e.g. `1.2` instead of `1.2.0`.

## Are ranges supported? How?

Composer supports ranges in a similar manner to npm, but not identical. The main difference is with tilde ranges.

Tilde ranges with "short" versions are different to npm. e.g.

`~4` is equivalent to `^4` in npm
`~4.1` is equivalent to `^4.1` in npm
`~0.4` is equivalent to `>=0.4 <1` in npm

## Range Strategy support

Composer versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Add composer2npm and npm2composer functions to leverage existing npm semver logic
- [x] Exact version support
- [x] Range support
