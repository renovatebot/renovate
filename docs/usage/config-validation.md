---
title: Config Validation
description: How to validate Renovate's configuration.
---

# Config Validation

All [`renovate` distributions](getting-started/running.md#available-distributions) contain a standalone validator program (`renovate-config-validator`) that can be used to validate Renovate's configuration.

The validator program checks files passed as CLI arguments.
If no argument is given, all [default locations](configuration-options.md) (if files exist) and the `RENOVATE_CONFIG_FILE` environment variable are checked.

```console
$ npm install --global renovate
added 750 packages, and audited 751 packages in 51s
$ renovate-config-validator
INFO: Validating renovate.json
INFO: Config validated successfully
```

The validator program fails with a non-zero exit code if there are any validation warnings or errors.
You can pass the `--strict` flag to make it fail if a scanned config needs migration.

You can configure a [pre-commit](https://pre-commit.com) hook to validate your configuration automatically.
Please check out the [`renovatebot/pre-commit-hooks` repository](https://github.com/renovatebot/pre-commit-hooks) for more information.
