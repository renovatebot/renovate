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
$ renovate-config-validator first_config.json
 INFO: Validating first_config_.json
 INFO: Config validated successfully
```

## Validate your config automatically

You can create a [pre-commit](https://pre-commit.com) hook to validate your configuration automatically.
Go to the [`renovatebot/pre-commit-hooks` repository](https://github.com/renovatebot/pre-commit-hooks) for more information.

### Validation of Renovate config change PRs

Renovate can validate configuration changes in Pull Requests when you use a special branch name.

Follow these steps to validate your configuration:

1. Create a new Git branch that matches the `{{branchPrefix}}reconfigure` pattern. For example, if you're using the default prefix `renovate/`, your branch name must be `renovate/reconfigure`.
1. Commit your updated Renovate config file to this branch, and push it to your Git hosting platform.

The next time Renovate runs on that repo it will:

1. Search for a branch that matches the special reconfigure pattern.
1. Check for a config file in the reconfigure branch. Renovate can even find a renamed configuration file (compared to the config file in the default branch).
1. Add a passing or failing status to the branch, depending on the outcome of the config validation run.
1. If there's an _open_ pull request with validation errors from the _reconfigure_ branch then Renovate comments in the PR with details.
1. Validate each commit the next time Renovate runs on the repository, until the PR is merged.
