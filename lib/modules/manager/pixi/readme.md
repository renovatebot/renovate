### Pixi package manager

Whenever the pixi config in `pyproject.toml` or `pixi.toml` file is updated, the `pixi.lock` file will be checked for updates as well.

Currently support channels from anaconda and prefix.dev, other channels is not suppoted yet.

Renovatebot will pick pixi based on known lock file version and pixi version mapping,
optionally you can set `constraints.pixi` in your config to override this.

The minimal support version of pixi is `0.40.0`, when you are setting `constraints.pixi` in your config, please be carefully.
