# Gitea

Renovate uses modern Git upload filters to suppress large blob downloads.
For Gitea you need to manually enable upload filters.
Read the official [Gitea docs](https://docs.gitea.io/en-us/clone-filters/) for more information.

## Unsupported platform features/concepts

- **Adding reviewers to PRs not supported**: Gitea versions older than v1.14.0 do not have the required API.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the Gitea repository itself, and this cannot be overridden yet
