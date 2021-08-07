---
title: Python Package Manager Support
description: Python/pip dependencies support in Renovate
---

# Python package manager support

Renovate supports the following Python package managers:

- `pip` (e.g. `requirements.txt`, `requirements.pip`) files
- `pipenv` (e.g. `Pipfile`)
- `setup.py` file
- `setup.cfg` file

## Versioning support

The [PEP440](https://www.python.org/dev/peps/pep-0440/) versioning scheme has been rewritten for JavaScript for the purposes of use in this project is published as [@renovatebot/pep440](https://github.com/renovatebot/pep440).
It supports both pinned versions as well as ranges.
Legacy versions (`===` prefix) are ignored.

## How it works

1. Renovate searches through each repository for package files
1. Existing dependencies are extracted from the package files
1. Renovate looks up the latest version on [PyPI](https://pypi.org/) to determine if any upgrades are available
1. If the source package includes a GitHub URL as its source, and has a "changelog" file or uses GitHub releases, a Release Note will be embedded in the generated PR

## Alternative file names

The default file matching regex for `requirements.txt` aims to pick up the most popular conventions for file naming, but it's possible that some get missed.
If you have a specific file or file pattern you want the Renovate bot to find, use the `fileMatch` field in the `pip_requirements` object.
e.g.:

```json
  "pip_requirements": {
    "fileMatch": ["my/specifically-named.file", "\.requirements$"]
  }
```

## Alternate registries

By default Renovate performs all lookups on pypi.org, but you can configure alternative index URLs.
There are two ways to do this:

### index-url in `requirements.txt`

The index URL can be specified in the first line of the file.
For example:

```
--index-url http://example.com/private-pypi/
some-package==0.3.1
some-other-package==1.0.0
```

### Sources in `Pipfile`

Renovate detects any custom-configured sources in `Pipfile` and uses them.

### Specify URL in configuration

You can use the `registryUrls` array to configure alternate index URL(s).
e.g.:

```json
  "python": {
    "registryUrls": ["http://example.com/private-pypi/"]
  }
```

Note: the index-url found in the `requirements.txt` file takes precedence over a `registryUrl` configured like the above.
To override the URL found in `requirements.txt`, you need to configure it in `packageRules`, as they are applied _after_ package file extraction.

## Disabling Python support

The most direct way to disable all Python support in Renovate is like this:

```json
  "python": {
    "enabled": false
  }
```

Alternatively, maybe you only want one package manager, such as `npm`.
In that case this would enable _only_ `npm`:

```json
  "enabledManagers": ["npm"]
```
