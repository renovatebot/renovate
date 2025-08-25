This datasource finds Unity package updates from Unity package feeds.

By default, Renovate checks `https://packages.unity.com` for Unity packages.

You can override the default behavior with the `registryUrls` config option.
For example:

```json
{
  "matchDatasources": ["unity3d-packages"],
  "registryUrls": ["https://package.openupm.com"]
}
```
