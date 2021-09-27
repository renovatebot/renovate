# Gitea

## Unsupported platform features/concepts

- **Adding reviewers to PRs not supported**: Gitea versions older than v1.14.0 do not have the required API.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the Gitea repository itself, and this cannot be overridden yet
