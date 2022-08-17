---
title: Versioning
---

# Versioning

Once Managers have extracted dependencies, and Datasources have located available versions, then Renovate will use a "Versioning" scheme to perform sorting and filtering of results.
The "versioning" is different for each package manager, because different package managers use different versioning schemes.
For example, `npm` uses`1.0.0-beta.1` and `pip` uses `1.0.0b1`.

## Why you might need to manually configure versioning

Renovate interprets versions correctly out-of-the-box most of the time.
It's impossible to automatically detect **all** versioning schemes, so sometimes you need to tell the bot what versioning scheme it should use.

You can manually configure/override the `versioning` value for a particular dependency.
You generally won't need to override the defaults for ecosystems which enforce a strict version scheme like `npm`.

Configuring or overriding the default `versioning` can be particularly helpful for ecosystems like Docker/Kubernetes/Helm, where versioning is barely a "convention".

## General concepts behind overriding versioning

- Although you can reconfigure versioning per-manager or per-datasource, it's unlikely that such a broad change would ever be needed
- More commonly you would need to configure `versioning` for individual packages or potentially package patterns
- The best way to do this is with `packageRules`, with a combination of `matchManagers`, `matchDatasources`, `matchPackageNames` and `matchPackagePatterns`.
  Avoid configuring `versioning` in a rule that also uses `matchUpdateTypes`, as the update types aren't known at the time the `versioning` is applied.

## Examples of versioning overrides

### Overriding Docker versioning to use a versioning specific for a package

The configuration below overrides Renovate's default `docker` versioning for the `python` Docker image and instead uses the `pep440` versioning scheme to evaluate versions.

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["python"],
      "versioning": "pep440"
    }
  ]
}
```

### Using a custom regex versioning scheme

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["foo/bar"],
      "versioning": "regex:^(?<compatibility>.*)-v?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)?$"
    }
  ]
}
```

## Supported Versioning

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->
