### Pixi package manager

Currently support channels from anaconda and prefix.dev, other channels are not supported yet.

Whenever the pixi config in `pyproject.toml` or `pixi.toml` file is updated, `pixi.lock` file will be checked for updates as well.

When using `pyproject.toml`, standard PEP 621 dependencies (e.g. `[project.dependencies]` or `[dependency-groups]`) are handled by the `pep621` manager, which also updates `pixi.lock` when those dependencies change.

### Trust model for pixi lock file updates

Running `pixi lock` can execute arbitrary code from conda package hooks, so Renovate treats `pixi.lock` refreshes as an unsafe execution.
See [pixi's security documentation](https://pixi.prefix.dev/latest/security/#4-treat-package-hooks-as-code-execution) for details.

Self-hosted administrators must explicitly allow this path by including `pixi` in the global [`allowedUnsafeExecutions`](../../../self-hosted-configuration.md#allowedunsafeexecutions) setting.
When `pixi` is not allowed, the package file is still updated, but `pixi.lock` is left unchanged.

Renovatebot will pick pixi version in following order:

1. renovatebot setting `constraints.pixi`
2. `requires-pixi` in `pixi.toml`

The minimal support version of pixi is `0.40.0` (`pixi lock` has only been introduced with that version).
Therefore when you are setting `constraints.pixi` in your renovatebot config or `requires-pixi` in `pixi.toml`, please be careful to pick a supported pixi version.
