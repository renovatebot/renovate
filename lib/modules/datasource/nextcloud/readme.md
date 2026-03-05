This datasource finds Nextcloud application updates from Nextcloud feeds.

By default, Renovate has no default registry url for this datasource. You need to override the default behavior with the `registryUrls` config option.
For example:

```json
{
  "matchDatasources": ["nextcloud"],
  "registryUrls": [
    "https://apps.nextcloud.com/api/v1/platform/30.0.0/apps.json"
  ]
}
```

Additionally, if you want Renovate to automatically update the platform version, you can create a custom manager.
For example:

```json
{
  "customType": "regex",
  "managerFilePatterns": ["/(^|/)renovate.json$/"],
  "matchStrings": [
    "https://apps.nextcloud.com/api/v1/platform/(?<currentValue>\\d+\\.\\d+\\.\\d+)/apps.json"
  ],
  "depNameTemplate": "nextcloud/server",
  "datasourceTemplate": "github-releases"
}
```
