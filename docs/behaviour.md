# Script Behaviour

This file documents the design choices as well as configuration options.

## Synchronous Operation

The script current processes repositories, package files, and dependencies within them all synchronously.
- Greatly reduces chance of hitting GitHub API limits
- Implicitly enables any feature that results in multiple commits in the same branch
- Simplifies logging

Note: Initial queries to NPM are done in parallel.

## Multiple Configuration Methods

The script supports multiple [configuration methods](configuration.md) concurrently, and processed in order of priority.
This allows examples such as token configured via environment variable and labels configured via target `package.json`.

## Cascading Configuration

Configuration options applied per-package file override those per-repository, which override those which are global (all repositories).

The following options apply per-package file:

- Dependency Types
- Ignored Dependencies
- Labels
- Recreate PRs

The following options apply per-repository:

- Token

The following options apply globally:

- Log Level

## One PR per Major release

`renovate` will create multiple branches/PRs if multiple major branch upgrades are available. For example if the current example is 1.6.0 and upgrades to 1.7.0 and 2.0.0 exist, then `renovate` will raise PRs for both the 1.x upgrade(s) and 2.x upgrade(s).

- It's often the case that projects can't upgrade major dependency versions immediately.
- It's also often the case that previous major versions continue receiving Minor or Patch updates.
- Projects should get Minor and Patch updates for their current Major release even if a new Major release exists

## Branch naming

Branches are named like `renovate/webpack-1.x` instead of `renovate/webpack-1.2.0`.

- Branches often receive updates (e.g. new patches) before they're merged.
- Naming the branch like `1.x` means its name still names sense if a `1.2.1` release happens

Note: Branch names are configurable using the `templates` field.

## Pull Request Recreation

By default, the script does not create a new PR if it finds an identical one already closed. This allows users to close unwelcome upgrade PRs and worry about them being recreated every run. Typically this is most useful for major upgrades.
This option is configurable.
