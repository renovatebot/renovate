---
title: Datasources
---

# Datasources

Once Renovate's manager has scanned the files and extracted the dependencies, it assigns a `datasource` to each extracted package file or dependency.
The `datasource` tells Renovate how to search for new versions.

You don't need to configure or override datasources directly.
But you may use datasources in a `packageRules` array to configure other aspects of Renovate's behavior, for example:

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

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->
