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

### Validation of Renovate config change PRs

Renovate can validate configuration changes in Pull Requests as long as you use a designated branch name.

Follow these steps:

1. Create a new Git branch that matches the `{{branchPrefix}}reconfigure` pattern.
   For example, if you're using the default prefix `renovate/`, your branch name must be `renovate/reconfigure`. Commit your updated Renovate config file to this branch, and push it to your Git hosting platform.

2. Each time Renovate runs, it searches for a branch that matches the reconfigure pattern and validates the Renovate configuration file.

3. Renovate will check for a config file in the reconfigure branch, even if it has been renamed compared to the existing config file in the default branch.

4. Depending on the outcome of the Renovate config validation run, Renovate will add a passing or failing check to the branch.

5. If there's an open pull request from the _reconfigure_ branch then Renovate will comment in that PR with details in case there are validation errors. Each commit will be revalidated the next time Renovate runs on the repository.
