This datasource can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

This datasource returns a reference from a Git repository.
The `depName` must be a fully qualified domain name.
To fetch the latest digest of a reference instead of the named reference, specify the reference as the `currentValue` and match on the `currentDigest`.

**Usage example**

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
