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

<!-- prettier-ignore -->
!!! note
    The `renovate-config-validator` program is meant to validate one file per run.
    Avoid checking multiple files in one run.

### Strict mode

By default, the validator program fails with a non-zero exit code if there are any validation warnings or errors.
You can pass the `--strict` flag to make it fail if a scanned config needs migration.

### Pass file to check as CLI arguments

You can pass the file you want to check to the `renovate-config-validator` program with a CLI argument.
This can be handy to check a config file with a non-default name, like when you're using preset repositories.
For example:

```console
$ npm install --global renovate
added 750 packages, and audited 751 packages in 51s
$ renovate-config-validator first_config.jsonn
 INFO: Validating first_config_.json
 INFO: Config validated successfully
```

## Validate your config automatically

You can create a [pre-commit](https://pre-commit.com) hook to validate your configuration automatically.
Go to the [`renovatebot/pre-commit-hooks` repository](https://github.com/renovatebot/pre-commit-hooks) for more information.
