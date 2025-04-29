---
title: Versioning
---

# Versioning

Versioning is one of Renovate's four core "module" types (alongside Platform, Manager and Datasource).
Versioning is used to determine the answer to questions such as:

- Is this a valid version string?
- Is this a valid constraint/range?
- Does this version match with this constraint?
- If the current constraint is X, what would the new constraint be if we updated to version Y?
- Is this a major, minor or patch update?
- Is this a breaking change?

Once Managers have extracted dependencies, and Datasources have located available versions, then Renovate will use a "Versioning" scheme to perform sorting and filtering of results.
The "versioning" chosen can be different per package manager, because different package managers use different versioning schemes.
For example, `npm` uses `1.0.0-beta.1` while `pip` uses `1.0.0b1`.

## Why you might need to manually configure versioning

Renovate interprets versions correctly out-of-the-box most of the time.
But Renovate can't automatically detect **all** versioning schemes.
So sometimes you need to tell the bot what versioning scheme it should use.

For some ecosystems, automatic version selection works nearly every time (e.g. for npm-compliant managers, use npm versioning).
For other ecosystems such as Docker or GitHub tags, there is no consistent convention for versions, so the default choice may not always work.
For example some Docker images may use SemVer, some PEP440, some Calendar Versioning, etc.

To allow for such cases, you can manually configure or override the `versioning` value for a particular dependency.

## General concepts behind overriding versioning

- Although you can reconfigure versioning per-manager or per-datasource, you probably don't need such a broad change
- More commonly you would need to configure `versioning` for individual packages or potentially package patterns
- The best way to do this is with `packageRules`, with a combination of `matchManagers`, `matchDatasources`, and `matchPackageNames`.
  Avoid configuring `versioning` in a rule that also uses `matchUpdateTypes`, as the update types aren't known at the time the `versioning` is applied

## Examples of versioning overrides

### Overriding Docker versioning to use a versioning specific for a package

The configuration below overrides Renovate's default `docker` versioning for the `python` Docker image and instead uses the `pep440` versioning scheme to evaluate versions.

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["python"],
      "versioning": "pep440"
    }
  ]
}
```

### Using a custom regex versioning scheme

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["foo/bar"],
      "versioning": "regex:^(?<compatibility>.*)-v?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)?$"
    }
  ]
}
```

## Breaking Changes

In most ecosystems, especially SemVer, major upgrades are synonymous with breaking changes.
However, there are other cases too:

- In SemVer, any update from a 0.x version may be breaking (including `0.1.0` -> `0.1.1`, `0.1.0` -> `0.2.0` and `0.1.0` -> `1.0.0`)
- Updates from pre-release versions like `1.0.0-pre.1` to other versions (including stable versions like `1.0.0`) can be breaking
- Python makes breaking changes in minor updates, e.g. from `3.12` to `3.13`

It can be tempting to propose ideas like "let's treat minor updates of Python as major updates" but that is swapping one problem for a worse problem.
The definitions of major and minor should not be redefined and broken in order to shoehorn in the related concept of "breaking change".
Instead, Renovate has the concept of `isBreaking`, which can be decided independently of `updateType`.

Here's an example of grouping all non-breaking updates together:

```json
{
  "packageRules": [
    {
      "description": "Group together non-breaking updates",
      "matchUpdateTypes": ["minor", "patch", "digest"],
      "matchJsonata": ["isBreaking != true"],
      "groupName": "Non-breaking updates"
    }
  ]
}
```

## Supported Versioning

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->
