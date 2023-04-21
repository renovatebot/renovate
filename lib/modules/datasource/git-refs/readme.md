This datasource can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

This datasource returns a reference from a Git repository.
The `packageName` must be a fully qualified domain name.
To fetch the latest digest of a reference instead of the named reference, specify the reference as the `currentValue` and match on the `currentDigest`.

**Usage example**

The following is an example where you would maintain the HEAD digest of the `master` branch of a repository.
You would configure a generic regex manager in `renovate.json` for files named `versions.ini`:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^versions.ini$"],
      "matchStrings": ["GOOGLE_API_VERSION=(?<currentDigest>.*?)\\n"],
      "currentValueTemplate": "master",
      "depNameTemplate": "googleapis",
      "packageNameTemplate": "https://github.com/googleapis/googleapis",
      "datasourceTemplate": "git-refs"
    }
  ]
}
```
