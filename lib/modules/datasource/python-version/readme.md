This datasource returns Python releases from the [python.org API](https://www.python.org/api/v2/downloads/release/).

It also fetches deprecated versions from [Endoflife Date Datasource](/modules/datasource/endoflife-date/)

Because Renovate depends on [containerbase/python-prebuild](https://github.com/containerbase/python-prebuild/releases) it will also fetch Github API for releases there.

## Example custom manager

Below is a [custom regex manager](/modules/manager/regex/) for updating Python version in a Dockerfile. Python version in some cases omits dot separating major and minor number, ex.: `3.11` becomes `311`. So this example handles this case.

```dockerfile
ARG PYTHON_VERSION=311
FROM image-python${PYTHON_VERSION}-builder:1.0.0
```

```json
"customManagers": [
  {
    "customType": "regex",
    "fileMatch": ["^Dockerfile$"],
    "matchStringsStrategy": "any",
    "matchStrings": ["ARG PYTHON_VERSION=\"?(?<currentValue>3(?<minor>\\d+))\"?\\s"],
    "autoReplaceStringTemplate": "ARG PYTHON_VERSION={{{replace '\\.' '' newValue}}}\n",
    "currentValueTemplate": "3.{{{minor}}}",
    "datasourceTemplate": "python-version",
    "versioningTemplate": "python",
    "depNameTemplate": "python"
  }
]
```
