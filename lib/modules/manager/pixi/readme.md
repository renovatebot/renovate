### Pixi package manager

Currently support channels from anaconda and prefix.dev, other channels are not supported yet.

Whenever the pixi config in `pyproject.toml` or `pixi.toml` file is updated, `pixi.lock` file will be checked for updates as well.

Renovatebot will pick a pixi version based on known mapping between lockfile version and pixi version.
This is done in order to avoid upgrading the lock file version.
Optionally you can set `constraints.pixi` in your config to override this.

The minimal support version of pixi is `0.40.0` (`pixi lock` has only been introduced with that version).
Therefore when you are setting `constraints.pixi` in your config, please be careful to pick a supported pixi version.

This also means if you have a lock file with version `<6`, renovatebot can't generate lock file with same version, it will upgrade lock file to latest version.
