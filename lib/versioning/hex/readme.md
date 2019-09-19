# Hex versioning

## Documentation and URLs

https://hexdocs.pm/elixir/Version.html#module-requirements

This versioning syntax is used for Elixir and Erlang hex dependencies

## What type of versioning is used?

Hex versions are based on [Semantic Versioning 2.0](https://semver.org)

## Are ranges supported? How?

Hex supports a [subset of npm range syntax](https://hexdocs.pm/elixir/Version.html).

## Range Strategy support

Hex versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Add hex2npm functions to leverage existing npm semver logic
- [x] Exact version support
- [x] Range support
