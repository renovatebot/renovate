[Julia](https://julialang.org/)'s [`Pkg`](https://pkgdocs.julialang.org/) uses [Semantic Versioning 2.0](https://semver.org/) with a few syntactic differences from npm:

**Caret is the default specifier**

Bare versions in `Project.toml`'s `[compat]` section are interpreted as caret ranges. `Example = "1.2.3"` is the same as `Example = "^1.2.3"`, i.e. `[1.2.3, 2.0.0)`.

**Comma is union, not intersection**

Multiple specifiers separated by commas form a union: `Example = "1.2, 2"` resolves to `[1.2.0, 3.0.0)`. (Contrast with Cargo, where comma is intersection.)

**`≥` is a synonym for `>=`**

`Example = "≥ 1.2.3"` is equivalent to `Example = ">= 1.2.3"`.

**Hyphen ranges**

`1.2.3 - 4.5.6` resolves to `[1.2.3, 4.5.6]`. Trailing components in the second endpoint are wildcards (`1.2.3 - 4.5` resolves to `[1.2.3, 4.6.0)`); trailing components in the first endpoint are zeros (`1.2 - 4.5.6` resolves to `[1.2.0, 4.5.6]`).

Tilde and caret semantics, including the leading-zero behaviour, match npm's.

See the [Julia Pkg compatibility docs](https://pkgdocs.julialang.org/v1/compatibility/) for the full specification.
