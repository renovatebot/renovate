This manager supports updating dependencies inside `pyproject.toml` files.

In addition to standard dependencies, these toolsets are also supported:

- `pdm` ( including `pdm.lock` files )

Available `depType`s:

- `project.dependencies`
- `project.optional-dependencies`
- `tool.pdm.dev-dependencies`
