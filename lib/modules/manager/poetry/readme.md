Both Poetry 0.x and 1.x versions are supported.

Whenever the `pyproject.toml` file is updated, the Poetry lock file will be checked for updates as well.

The following `depTypes` are supported by the Poetry manager:

- `dependencies`
- `dev-dependencies`
- `extras`
- `<group-name>` (dynamic, based on the group name, per [dependency groups documentation](https://python-poetry.org/docs/managing-dependencies/#dependency-groups))
