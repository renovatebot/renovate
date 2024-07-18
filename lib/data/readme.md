# Introduction

The `lib/data` folder has all our crowdsourced data files.
This readme explains what each file is used for.

## Summary

| File            | What is the file about?                  |
| --------------- | ---------------------------------------- |
| `monorepo.json` | Group related packages into a single PR. |

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
