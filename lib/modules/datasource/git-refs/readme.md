You can use this datasource plus [regex managers](../../manager/regex/index.md) to update git-based dependencies that are not natively supported by Renovate.

The `git-refs` datasource returns a reference from a Git repository.

The `packageName` must be a fully qualified domain name.

To fetch the latest _digest_ of a reference instead of the named reference: put the named reference in `currentValue` and match on the `currentDigest`.

**Usage example**

Say you want to maintain the `HEAD` digest of the `master` branch of a repository.
You would configure a custom manager in your Renovate config file for files named `versions.ini`:

```json
{
  "customManagers": [
    {
      "customType": "regex",
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
