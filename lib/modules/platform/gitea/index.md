# Gitea

Renovate uses modern Git upload filters to suppress large blob downloads.
For Gitea you need to manually enable upload filters.
Read the official [Gitea docs](https://docs.gitea.io/en-us/clone-filters/) for more information.

## Authentication

First, [create a Personal Access Token](https://docs.gitea.io/en-us/api-usage/#authentication) for the bot account.
Let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

Remember to set `platform=gitea` somewhere in your Renovate config file.
Either the account should have full name and email address set to allow Renovate to estabilish Git identity, or the `gitAuthor` config option should be set.

## Unsupported platform features/concepts

- **Adding reviewers to PRs not supported**: Gitea versions older than v1.14.0 do not have the required API.
- **Setting `platformAutomerge` to use platform-native automerge for PRs not supported**: Gitea versions older than v1.17.0 do not have the required API.

## Features awaiting implementation

- none

## Repo autodiscover sorting

You can change the default server-side sort method and order for autodiscover API.
Set those via [`RENOVATE_X_AUTODISCOVER_REPO_SORT`](https://docs.renovatebot.com/self-hosted-experimental/#renovate_x_autodiscover_repo_sort) and [`RENOVATE_X_AUTODISCOVER_REPO_ORDER`](https://docs.renovatebot.com/self-hosted-experimental/#renovate_x_autodiscover_repo_order).
Read the [Gitea swagger docs](https://try.gitea.io/api/swagger#/repository/repoSearch) for more details.
