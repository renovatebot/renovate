# Datasources

Once Renovate's Managers are done scanning files and extracting dependencies, they will assign a `datasource` to each so that Renovate then knows how to search for new versions.
You do not need to ever configure/override Datasources directly, but you may use them in `packageRules` to configure other aspects of Renovate's behavior, e.g.

```json
{
  "packageRules": [
    {
      "datasources": ["npm"],
      "packageNames": ["lodash"],
      "automerge": true
    }
  ]
}
```

## Supported Datasources

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->
