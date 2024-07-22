# Introduction

The `lib/data` folder has all our crowdsourced data files.
This readme explains what each file is used for.

## Summary

| File                | What is the file about?                  |
| ------------------- | ---------------------------------------- |
| `monorepo.json`     | Group related packages into a single PR. |
| `replacements.json` | Rename old packages to new replacement.  |

## Group related packages (`monorepo.json`)

The `monorepo.json` file has all the monorepo presets.

Monorepo presets group related packages, so they are updated with a single Renovate PR.

### Ways to group packages

There are three ways to group packages:

| Group packages                      | Method          |
| ----------------------------------- | --------------- |
| From the same source repository.    | `repoGroups`    |
| From the same organization.         | `orgGroups`     |
| Based on name patterns or prefixes. | `patternGroups` |

## Rename old packages (`replacements.json`)

The `replacements.json` file has all the replacement presets.

When a package gets renamed, you need to tell Renovate:

- the datasource of the package -> `matchDatasources`
- the old package name -> `matchPackageNames`
- the new package name -> `replacementName`
- the last version available for the old package name -> `matchCurrentVersion`
- the first version available for the new package name -> `replacementVersion`

Example:

```json
{
  "matchCurrentVersion": ">=3.10.3",
  "matchDatasources": ["npm"],
  "matchPackageNames": [
    "apollo-server",
    "apollo-server-core",
    "apollo-server-express"
  ],
  "replacementName": "@apollo/server",
  "replacementVersion": "4.0.0"
}
```
