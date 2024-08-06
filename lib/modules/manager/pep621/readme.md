This manager supports updating dependencies inside `pyproject.toml` files.

In addition to standard dependencies, these toolsets are also supported:

-   `pdm` (including `pdm.lock` files)
-   `hatch`

Available `depType`s:

-   `project.dependencies`
-   `project.optional-dependencies`
-   `build-system.requires`
-   `tool.pdm.dev-dependencies`
-   `tool.hatch.envs.<env-name>`
