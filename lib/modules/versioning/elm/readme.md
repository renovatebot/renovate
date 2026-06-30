Elm enforces strict [Semantic Versioning](https://semver.org/) at the compiler level, automatically detecting API changes and requiring appropriate version bumps.

**Ranges**

Elm packages use range constraints in the format `1.0.0 <= v < 2.0.0`, where the lower bound is inclusive and the upper bound is exclusive.

**Exact versions**

Elm applications use exact versions like `1.0.0` in their `elm.json` files.

Both exact versions and ranges are fully supported.
