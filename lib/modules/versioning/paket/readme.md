Paket versioning implements the version constraint syntax of the [`paket.dependencies` file](https://fsprojects.github.io/Paket/dependencies-file.html).

Paket versions _are_ NuGet versions, so version parsing and comparison match the `nuget` versioning module.
But the range syntax differs from NuGet ranges and the two conflict where they overlap: a plain version like `1.2.3` is an exact pin in Paket, while NuGet range syntax treats it as "at least `1.2.3`".
This is why Paket needs its own versioning module.

The following constraints are supported:

| Constraint           | Meaning                                        |
| :------------------- | :--------------------------------------------- |
| `1.2.3` or `= 1.2.3` | exactly version `1.2.3`                        |
| `== 1.2.3`           | exactly version `1.2.3`, overriding conflicts  |
| `>= 1.2.3`           | at least version `1.2.3`                       |
| `> 1.2.3`            | greater than version `1.2.3`                   |
| `<= 1.2.3`           | at most version `1.2.3`                        |
| `< 1.2.3`            | less than version `1.2.3`                      |
| `~> 1.2.3`           | pessimistic constraint, `>= 1.2.3` and `< 1.3` |
| `>= 1.2.3 < 1.5`     | combined bounds                                |
| `~> 1.2 >= 1.2.3`    | pessimistic constraint with a floor            |

Prerelease channels may follow the constraint, like `>= 1.2.3 alpha` or `~> 1.2 prerelease`.
Stable versions always match, while prerelease versions only match when their channel is listed, or when the `prerelease` keyword allows all of them.
A constraint written with a prerelease version, like `~> 1.2.3-alpha001`, allows its own channel implicitly.
Following Paket, the literal `prerelease` suffix sorts below any other prerelease of the same version, so `1.2.3-prerelease` acts as a floor under all prereleases of `1.2.3`.

The resolver strategy prefixes `!` and `@`, like `!~> 1.2`, do not change which versions match and are preserved when Renovate updates a range.

When Renovate replaces a range, it keeps the shape of the constraint:

- exact pins stay exact pins, and `==` keeps its operator
- `~> 1.2` becomes `~> 2.0` at the same precision
- upper bounds move up just far enough, so `>= 1.2.3 < 2.0` becomes `>= 1.2.3 < 2.2` for version `2.1.4`
- a `~> 1.2 >= 1.2.3` pair follows the new version as a pair, dropping a floor that becomes redundant
- if the new version is a prerelease which the rewritten range would block, its channel is appended, like `>= 1.2 beta`

The `bump` strategy raises the floor to the exact new version where the syntax allows it, for example `~> 1.2` becomes `~> 1.2 >= 1.2.5`.
The `widen` strategy keeps the lower bound and only extends the upper bound, decomposing `~> 1.2` into `>= 1.2 < 3` when needed.
