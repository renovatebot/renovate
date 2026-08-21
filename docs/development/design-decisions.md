# Design Decisions

This file documents the design choices as well as configuration options.

## Intended use by end-users

The Renovate repository/package is intended to be used as a CLI-based application.
It should not be used downstream as a library, because it lacks a stable API.

End users should only depend on the CLI or on the official hosted app.
The Renovate npm package should only be used as a CLI tool.

## Stateless

A key feature of Renovate is that it does not require any state storage (e.g. on disk or in a database).
Instead, Renovate's source of truth is the repository itself, e.g. branches, Issues and Pull Requests.
Due to this design, it is possible to stop the script at any time without risking Renovate state being out of sync with repository state.

## Synchronous Operation

The script processes repositories and branches within them synchronously.
This has the following benefits:

- Greatly reduces the chance of hitting simultaneous API rate limits
- Simplifies logging

## Cascading Configuration

We use a cascading configuration.
This means that specific configuration options always override more general configuration options.

From most specific to least specific:

1. Update type (e.g. `major`, `minor`, `patch`)
1. Package (e.g. `lodash`, `django`)
1. Manager (e.g. `npm`, `pypi`)
1. Repository config
1. Global configuration

## Automatic discovery of package file locations

The default behavior is to auto-discover all package file (e.g. `package.json`) locations in a repository and process them all.
Doing so means that "monorepos" are supported by default.

This behavior can be overridden by the configuration option `includePaths`, where you list the file paths manually.
You could limit Renovate to only update the `package.json` in the root of the repository and ignore `package.json` files in other directories.

## Separate Branches per dependency

By default, `renovate` will maintain separate branches for each dependency.
So if 20 dependencies need updating, there will be at least 20 branches/PRs.
Although this may seem undesirable, it's even less desirable if all 20 were in the same Pull Request and it's very difficult to work out which upgrade caused the test failure.

But you can override the default templates for branch name to get a single branch for all dependencies.
The `groupName` configuration option can be used at a repository level (e.g. give it the value `All`) and then all dependency updates will be in the same branch/PR.

## Separate Minor and Major PRs

`renovate` will create multiple branches/PRs if both major and minor branch upgrades are available.
For example, if the current example is 1.6.0 and upgrades to 1.7.0 and 2.0.0 exist, then `renovate` will raise PRs for both the 1.x upgrade(s) and 2.x upgrade(s).

Our reasons for separating minor and major PRs:

- It's often the case that projects can't upgrade major dependency versions immediately
- It's also often the case that previous major versions continue receiving Minor or Patch updates
- Projects should get Minor and Patch updates for their current Major release even if a new Major release exists

This behavior can be overridden via the config option `separateMajorMinor`.

## Branch naming

Branches have names like `renovate/webpack-1.x` instead of `renovate/webpack-1.2.0`.

We do this because:

- Branches often get updates (e.g. new patches) before they're merged
- Naming the branch like `1.x` means its name still makes sense if a `1.2.1` release happens

Note: You can configure the branch names by using the string template `branchName` and/or its sub-templates `branchPrefix` and `branchTopic`.

## Pull Request Recreation

By default, the script does not create a new PR if it finds a previously-closed PR with the same branch name and PR title (assuming the PR title has a version in it).
This allows users to close unwelcome upgrade PRs and not worry about them being recreated every run.

## Rebasing Unmergeable Pull Requests

With the default behavior of one branch per dependency, it's often the case that a PR gets merge conflicts after an adjacent dependency update is merged.
On most platforms you can use a web interface to resolve merge conflicts, but you're still resolving the conflicts manually, which is annoying.

`renovate` will rebase any unmergeable branches and add the latest necessary commit on top of the most recent `main` commit.

Note: `renovate` will only do this if the original branch hasn't been modified by anyone else.

## Suppressing string templates from CLI

String templates (e.g. commit or PR name) are not configurable via CLI options, in order to not pollute the CLI help and make it unreadable.
If you must configure via CLI, use an environment variable instead. e.g.

```sh
RENOVATE_BRANCH_NAME=foo renovate
```

Alternatively, consider using a Configuration File.

## Logging and error levels

Renovate uses the following convention for log levels:

- logger.error should only be used for problems that are likely to be a Renovate bug or require Renovate improvements. These are the types of errors that Renovate administrators should be alerted to immediately
- logger.warn should be used for problems that might be a Renovate problem so should be checked periodically in batches
- For _user_ problems (e.g. configuration errors), these should not warn or error on the server side and instead use logger.info
