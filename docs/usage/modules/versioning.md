# Versioning

Once Managers have extracted dependencies, and Datasources have located available versions, then Renovate makes use of "Versioning" schemes to perform sorting and filtering of results.
This is necessary because different managers use different types of numbering/versioning, e.g. `1.0.0-beta.1` in `npm` and `1.0.0b1` in Python.

## Configuring Versioning

There are times when you may need to manually configure/override the `versioning` value for a particular dependency.
You generally won't have a need for this in ecosystems with strict versioning enforcement like `npm`, but you might often need it for ecosystems like Docker where versioning is barely a "convention". e.g.

```json
{
  "packageRules": [
    {
      "datasources": ["docker"],
      "packageNames": ["python"],
      "versioning": "pep440"
    }
  ]
}
```

The above will override Renovate's default of `docker` versioning for the `python` Docker image and instead use `pep440` versioning to evaluate versions.

## Supported Versioning

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->
