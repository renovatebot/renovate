This datasource returns a ref from a Git repository. The `depName` must be a FQDN. To fetch the latest digest of a ref instead of the named ref, specify the ref as the `currentValue` and match on the `currentDigest`. This datasource can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

**Usage Example**

A real-world example for this specific datasource would be maintaining the HEAD digest of the `master` branch of an unversioned and untagged repo in a config file. This can be achieved by configuring a generic regex manager in `renovate.json` for files named `versions.ini`:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^versions.ini$"],
      "matchStrings": ["GOOGLE_API_VERSION=(?<currentDigest>.*?)\\n"],
      "currentValueTemplate": "master",
      "depNameTemplate": "https://github.com/googleapis/googleapis",
      "datasourceTemplate": "git-refs"
    }
  ]
}
```
