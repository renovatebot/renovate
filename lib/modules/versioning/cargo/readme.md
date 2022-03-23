Cargo versioning uses [Semantic Versioning 2.0](https://semver.org).

Cargo supports ranges in a similar manner to npm, but not identical. The important differences are:

**Use of commas**

Multiple version requirements can also be separated with a comma, e.g. `>= 1.2, < 1.5`. We interpret this to mean AND.

**No exact versions unless using equals =**

In Cargo, `1.2.3` doesn't mean "exactly 1.2.3", it actually means `>=1.2.3 <2.0.0`. So this is like the equivalent of `^1.2.3` in npm.
