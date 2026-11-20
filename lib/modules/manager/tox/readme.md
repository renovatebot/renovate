Supports the `requires` and `deps` fields in `tox.toml` and `pyproject.toml` (under `[tool.tox]`).

- `requires` specifies the tox version and plugins needed to run tox itself
- `deps` specifies the Python packages installed into each test environment

Both the base environment (`[env_run_base]`) and named environments (`[env.<name>]`) are supported.

Entries starting with `-` (e.g. `-r requirements.txt`, `-c constraints.txt`, `-e .`) are ignored.
