---
title: Python Package Manager Support
description: Python/pip dependencies support in Renovate
---

# Python Package Manager Support

Renovate supports upgrading dependencies in `pip` requirements (e.g. `requirements.txt`, `requirements.pip`) files.

## Versioning Support

The [PEP440](https://www.python.org/dev/peps/pep-0440/) versioning scheme has been rewritten for JavaScript for the purposes of use in this project is published as [@renovatebot/pep440](https://github.com/renovatebot/pep440). It supports both pinned versions as well as ranges. Legacy versions (`===` prefix) as not supported.

## How It Works

1.  Renovate will search each repository for any files requirements files it finds.
2.  Existing dependencies will be extracted from the file(s)
3.  Renovate will look up the latest version on [PyPI](https://pypi.org/) to determine if any upgrades are available
4.  If the source package includes a GitHub URL as its source, and has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Alternative file names

The default file matching regex for requirements.txt aims to pick up the most popular conventions for file naming, but it's possible that some get missed. If you have a specific file or file pattern you want to get found by Renovate, then you can do this by adding a new pattern under the `fileMatch` field of `pip_requirements`. e.g. you could add this to your config:

```json
  "pip_requirements": {
    "fileMatch": ["my/specifically-named.file", "\.requirements$"]
  }
```

## Disabling Python Support

The most direct way to disable all Python support in Renovate is like this:

```json
  "python": {
    "enabled": false
  }
```

Alternatively, maybe you only want one package manager, such as `npm`. In that case this would enable _only_ `npm`:

```json
  "enabledManagers": ["npm"]
```

## Future work

Feature requests are open for conda support, additional file types (e.g. `setup.cfg`), and of course `pipenv` support. You can locate these issues by filtering on the [#python](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%23python) hashtag in the repository. Please +1 and/or add a comment to each issue that would benefit you so that we can gauge the popularity/importance of each.
