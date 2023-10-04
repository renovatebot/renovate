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

### Reconfigure Renovate Config

To enable validation of your Renovate configuration changes, follow these steps:

1. Ensure that the branch name includes the prefix `{{branchPrefix}}reconfigure`.
   For example, if you're using the default prefix `renovate/`, your branch name should be `renovate/reconfigure`.

2. During each Renovate run, the bot searches for a branch with the reconfigure pattern and validates the associated configuration file.

3. Renovate does not assume that the config file has the same name as the default branch.
   You can also modify the config file name if needed.

4. If the configuration validation passes, Renovate adds a successful status check to the branch.
   In the event of validation failure, a failing status check is added.

5. Additionally, if there is an open pull request with the same branch, Renovate will post a comment on the PR listing all the validation errors for your reference.

These steps ensure that your Renovate configuration changes are validated effectively, helping you maintain a reliable and error-free setup.
