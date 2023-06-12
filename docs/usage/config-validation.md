---
title: Config Validation
description: How to validate Renovate's configuration.
---

# Config Validation

You can check your Renovate configuration with a standalone program called `renovate-config-validator`.
All [`renovate` distributions](getting-started/running.md#available-distributions) include this program.

## Default behavior

When you run `renovate-config-validator` with no arguments it will check:

- all [default locations](configuration-options.md) (if files exist)
- the `RENOVATE_CONFIG_FILE` environment variable

For example:

```console
$ npm install --global renovate
added 750 packages, and audited 751 packages in 51s
$ renovate-config-validator
INFO: Validating renovate.json
INFO: Config validated successfully
```

### Pass files to check as CLI arguments

Or you can pass the files to check to the `renovate-config-validator` program as CLI arguments.
For example:

```console
$ npm install --global renovate
added 750 packages, and audited 751 packages in 51s
$ renovate-config-validator ///// insert CLI arguments here
```

## Validate your config automatically

You can create a [pre-commit](https://pre-commit.com) hook to validate your configuration automatically.
Go to the [`renovatebot/pre-commit-hooks` repository](https://github.com/renovatebot/pre-commit-hooks) for more information.
