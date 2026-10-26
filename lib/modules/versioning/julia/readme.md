[Julia](https://julialang.org/)'s [`Pkg`](https://pkgdocs.julialang.org/) uses [Semantic Versioning 2.0](https://semver.org/) with a few syntactic differences from npm:

**Caret is the default specifier**

Bare versions in `Project.toml`'s `[compat]` section are interpreted as caret ranges.
`Example = "1.2.3"` is the same as `Example = "^1.2.3"`, i.e. `[1.2.3, 2.0.0)`.

**Comma is union, not intersection**

Multiple specifiers separated by commas form a union: `Example = "1.2, 2"` resolves to `[1.2.0, 3.0.0)`.
(Contrast with Cargo, where comma is intersection.)

**`≥` is a synonym for `>=`**

`Example = "≥ 1.2.3"` is equivalent to `Example = ">= 1.2.3"`.

**Hyphen ranges**

`1.2.3 - 4.5.6` resolves to `[1.2.3, 4.5.6]`.
Trailing components in the second endpoint are wildcards (`1.2.3 - 4.5` resolves to `[1.2.3, 4.6.0)`); trailing components in the first endpoint are zeros (`1.2 - 4.5.6` resolves to `[1.2.0, 4.5.6]`).

Tilde and caret semantics, including the leading-zero behavior, match npm's.

**Updating `[compat]` entries**

- `bump` raises the last specifier to the new version: `"0.10, 0.11"` with 0.12.1 becomes `"0.12.1"`.
- `replace` rewrites the entry only when the new version is outside it.
- `widen` keeps the entry and adds a specifier for the new version, the usual Julia convention: `"0.10, 0.11"` with 0.12.1 becomes `"0.10, 0.11, 0.12"`. The new specifier is `major.minor` (`0.minor` or `0.0.patch` below 1.0), a bare major next to a bare major (`"1, 2"` with 3.1.0 becomes `"1, 2, 3"`), takes the last specifier's `~` or `^` (`"~1.2"` with 1.3.0 becomes `"~1.2, ~1.3"`), and goes in ascending order.
- `pin` writes an exact version: `"=1.2.3"`.

Under every strategy, an exact pin such as `"=6.1.0"` stays exact (`"=6.1.1"`), and a hyphen range is left unchanged.
New values are written as `major.minor.patch`: Pkg rejects prerelease tags and build numbers in `[compat]`, so a JLL release `1.6.10+0` is written as `1.6.10`.

See the [Julia Pkg compatibility docs](https://pkgdocs.julialang.org/v1/compatibility/) for the full specification.
