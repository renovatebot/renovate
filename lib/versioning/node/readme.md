# node versioning

This "node" versioning is nearly identical to npm's semver except that it makes sure to strip "v" prefixes from exact versions when replacing.

## Documentation and URLs

https://semver.org/

## What type of versioning is used?

Node.JS's versioning complies with [Semantic Versioning 2.0](https://semver.org).

## Are ranges supported? How?

Same as npm.

## Range Strategy support

Same as npm

## Implementation plan/status

- [x] Strip v prefix
- [ ] Support Node.js-specific "stable" awareness
