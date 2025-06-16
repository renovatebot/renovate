This datasource returns Python releases from the [python.org API](https://www.python.org/api/v2/downloads/release/).

It also fetches deprecated versions from the [Endoflife Date datasource](../endoflife-date/index.md).

Because Renovate depends on [`containerbase/python-prebuild`](https://github.com/containerbase/python-prebuild/releases) it will also fetch releases from the GitHub API.

## Example custom manager

Below is a [custom regex manager](../../manager/regex/index.md) to update the Python versions in a Dockerfile.
Python versions sometimes drop the dot that separate the major and minor number: so `3.11` becomes `311`.
The example below handles this case.

```dockerfile
ARG PYTHON_VERSION=311
FROM image-python${PYTHON_VERSION}-builder:1.0.0
```

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/^Dockerfile$/"],
      "matchStringsStrategy": "any",
      "matchStrings": [
        "ARG PYTHON_VERSION=\"?(?<currentValue>3(?<minor>\\d+))\"?\\s"
      ],
      "autoReplaceStringTemplate": "ARG PYTHON_VERSION={{{replace '\\.' '' newValue}}}\n",
      "currentValueTemplate": "3.{{{minor}}}",
      "datasourceTemplate": "python-version",
      "versioningTemplate": "python",
      "depNameTemplate": "python"
    }
  ]
}
```
