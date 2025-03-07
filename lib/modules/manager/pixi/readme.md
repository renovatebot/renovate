### Pixi package manager

Whenever the pixi config in `pyproject.toml` or `pixi.toml` file is updated, the `pixi.lock` file will be checked for updates as well.

Currently support channels from anaconda and prefix.dev, other channels are not supported yet.

Renovatebot will pick pixi based on known lock file version and pixi version mapping,
optionally you can set `constraints.pixi` in your config to override this.

The minimal support version of pixi is `0.40.0` (`pixi lock` has only been introduced with that version).
Therefore when you are setting `constraints.pixi` in your config, please be careful to pick a supported pixi version.

Therefore, when `lockFileMaintenance` is enabled, renovatebot may upgrade lock file version from `<6` to latest lock file version. If you don't want such behavior, you need to disable renovatebot or upgrade your lock file version to at least 6.
