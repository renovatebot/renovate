### Pixi package manager

Currently support channels from anaconda and prefix.dev, other channels are not supported yet.

Whenever the pixi config in `pyproject.toml` or `pixi.toml` file is updated, `pixi.lock` file will be checked for updates as well.

Renovatebot will pick pixi version in following order:

1. renovatebot setting `constraints.pixi`
2. `requires-pixi` in `pixi.toml`
3. if version of `pixi.lock` is greater or equal than 6, renovatebot will pick known latest pixi version that generated same version of lock file.

The minimal support version of pixi is `0.40.0` (`pixi lock` has only been introduced with that version, which also generate a lock file version 6).
Therefore when you are setting `constraints.pixi` in your renovatebot config or `requires-pixi` in `pixi.toml`, please be careful to pick a supported pixi version.
