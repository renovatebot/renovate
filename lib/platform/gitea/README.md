# Gitea

Gitea support is considered in **beta** release status. Mostly, it just needs more feedback/testing. If you have been using it and think it's reliable, please let us know.

## Unsupported platform features/concepts

- **Adding reviewers to PRs not supported**: While Gitea supports a basic implementation for supporting PR reviews, no API support has been implemented so far.
- **Ignoring Renovate PRs by close**: As Gitea does not expose the branch name of a PR once it has been deleted, all issued pull requests are immortal.
