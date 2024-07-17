# Introduction

The `lib/data` folder has all our crowdsourced data files.
This readme explains what each file is used for.

## Summary

| File                           | What is the file about?                  |
| ------------------------------ | ---------------------------------------- |
| `monorepo.json`                | Group related packages into a single PR. |
| `replacements.json`            | Rename old packages to new replacement.  |
| `filename-for-changelogs.json` | Tell Renovate where to find changelogs.  |

## Group related packages (`monorepo.json`)

The `monorepo.json` file has all the monorepo presets.

Monorepo presets group related packages, so they are updated with a single Renovate PR.

We usually group packages that:

- depend on each other, or
- are in the same repository, or
- are in the same organization

### Ways to group packages

There are three ways to group packages:

| I want to group based on | Method          |
| ------------------------ | --------------- |
| Source repository URLs   | `repoGroups`    |
| Organization URls        | `orgGroups`     |
| Package name(s)          | `patternGroups` |
