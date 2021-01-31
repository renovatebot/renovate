# Versioning

Once Managers have extracted dependencies, and Datasources have located available versions, then Renovate will use a "Versioning" scheme to perform sorting and filtering of results.
The "versioning" is different for each package manager, because different package managers use different versioning schemes.
For example, `npm` uses`1.0.0-beta.1` and `pip` uses `1.0.0b1`.

## Configuring Versioning

You can manually configure/override the `versioning` value for a particular dependency.
You generally won't need to override the defaults for ecosystems which enforce a strict version scheme like `npm`.
Configuring or overriding the default `versioning` can be helpful for ecosystems like Docker, where versioning is barely a "convention". e.g.

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

The above will override Renovate's default of `docker` versioning for the `python` Docker image and instead use `pep440` versioning to evaluate versions.

## Supported Versioning

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->
