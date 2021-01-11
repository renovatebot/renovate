# Datasources

Once Renovate's manager is done scanning files and extracting dependencies, it will assign a `datasource` to each extracted package file and/or dependency so that Renovate then knows how to search for new versions.
You do not need to ever configure/override datasources directly, but you may use them in a `packageRules` array to configure other aspects of Renovate's behavior, e.g.

```json
{
  "packageRules": [
    {
      "matchDatasources": ["npm"],
      "matchPackageNames": ["lodash"],
      "automerge": true
    }
  ]
}
```

## Supported Datasources

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->
