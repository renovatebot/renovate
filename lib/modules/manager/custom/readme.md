This is a wrapper for any custom implementations and can be used to configure Renovate to find dependecies that are not detected by its other built-in package managers.

The following implementations are available as of now:

1. [regex](https://docs.renovatebot.com/modules/manager/custom/regex)

**Note:** `customManagers` was formerly known as `regexManagers`

Usage:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ]
}
```
