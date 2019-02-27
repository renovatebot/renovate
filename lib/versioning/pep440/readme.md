# PEP 440 versioning

## Documentation and URLs

https://www.python.org/dev/peps/pep-0440/

## What type of versioning is used?

PEP 440 is part of the Python project, and its versioning is independent of others such as semver.

## Are ranges supported? How?

Ranges are supported, with a proprietary syntax.

## Range Strategy support

PEP 440 versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Exact version support
- [x] Range support
