# Bitbucket Cloud

## Unsupported platform features/concepts

- Adding assignees to PRs not supported (does not seem to be a Bitbucket concept)
- `automergeStrategy=rebase` [is unsupported][bcloud-16610] by Bitbucket Cloud.

## Features requiring implementation

- Creating issues not implemented yet, e.g. when there is a config error
- Adding comments to PRs not implemented yet, e.g. when a PR has been edited or has a lockfile error

[bcloud-16610]: https://jira.atlassian.com/browse/BCLOUD-16610
