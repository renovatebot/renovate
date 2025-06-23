Both Poetry 0.x and 1.x versions are supported.

Whenever the `pyproject.toml` file is updated, the Poetry lock file will be checked for updates as well.

The following `depTypes` are supported by the Poetry manager:

- `dependencies`
- `dev-dependencies`
- `extras`
- `<group-name>` (dynamic, based on the group name, per [dependency groups documentation](https://python-poetry.org/docs/managing-dependencies/#dependency-groups))

<!-- prettier-ignore -->
!!! warning
    Updating locked versions of Poetry dependencies is at times unreliable.
    We recommended that you pin dependency versions in your `pyproject.toml` instead.

Renovate cannot accurately update locked versions of Poetry dependency ranges due to limitations in Poetry.
For example, if the `pyproject.toml` has a constraint like `coverage = "^7.2"`, and the version in `poetry.lock` is `7.4.1`, and we know that `7.4.3` is available, then Renovate can only run `poetry update --lock --no-interaction coverage` and _hope_ the result is `7.4.3`.
Poetry does not support updating to a specific/exact version with the `update` command, and the above `update` command may not even update at all sometimes.
For this reason it's much better to pin dependency versions in `pyproject.toml`, such as `coverage = "7.4.1"` because it then gives Renovate more control and the ability to accurate upgrade dependencies in increments like `7.4.1` to `7.4.3`.
