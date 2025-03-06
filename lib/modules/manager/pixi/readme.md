Support for pixi package manager

Whenever the pixi config in `pyproject.toml` or `pixi.toml` file is updated, the `pixi.lock` file will be checked for updates as well.

Currently support channels from anaconda and prefix.dev, third-part
channels without is not suppoted.
