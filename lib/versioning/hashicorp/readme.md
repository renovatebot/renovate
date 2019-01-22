# Hashicorp versioning

## Documentation and URLs

https://www.terraform.io/docs/configuration/terraform.html#specifying-a-required-terraform-version

This versioning syntax is used for Terraform only currently.

## What type of versioning is used?

Hashicorp uses [Semantic Versioning 2.0](https://semver.org).

## Are ranges supported? How?

Hashicorp supports a subset of npm's range syntax.

## Range Strategy support

Hashicorp versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Add hashicorp2npm functions to leverage existing npm semver logic
- [x] Exact version support
- [x] Range support
