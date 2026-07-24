This datasource looks up git tags from a [Gerrit](https://www.gerritcodereview.com/) instance via the [Projects REST API](https://gerrit-review.googlesource.com/Documentation/rest-api-projects.html#list-tags).

There is no default registry URL.
Set `registryUrls` (or `registryUrl` in a regex-manager comment) to the base URL of your Gerrit server.

`packageName` must be the Gerrit project name (for example `jenkinsci/gerrit-code-review-plugin`).
Project names that contain `/` are encoded automatically.

### Authentication

Gerrit only accepts HTTP credentials on URLs under the `/a/` prefix.
When a matching `hostRules` entry provides credentials for the Gerrit host (either `hostType: gerrit` or `hostType: gerrit-tags`), this datasource automatically uses the `/a/` prefix.
Without credentials, public/anonymous endpoints are used (no `/a/` prefix).

Example `hostRules` for a private Gerrit:

```json
{
  "hostRules": [
    {
      "matchHost": "gerrit.example.com",
      "hostType": "gerrit",
      "username": "renovate",
      "password": "http-password"
    }
  ]
}
```

### Usage example

Combine with a [custom manager](../../manager/regex/index.md) to track versions that are not covered by a built-in manager:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/^versions.ini$/"],
      "matchStrings": [
        "# renovate: datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?( registryUrl=(?<registryUrl>.*?))?\\s.*?_VERSION=(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ]
}
```

```ini
# renovate: datasource=gerrit-tags depName=jenkinsci/gerrit-code-review-plugin versioning=semver registryUrl=https://review.gerrithub.io
GERRIT_CODE_REVIEW_PLUGIN_VERSION=0.4.1
```
