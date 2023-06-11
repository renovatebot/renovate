# Gitea and Forgejo

Renovate supports [Gitea](https://gitea.io) and the [Forgejo](https://forgejo.org) fork.
Forgejo exists since `v1.18.0` and is currently fully compatible to Gitea.

## Authentication

First, [create a Personal Access Token (PAT)](https://docs.gitea.io/en-us/api-usage/#authentication) for the bot account.
Then let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

You must set `platform=gitea` in your Renovate config file.

Either the account should have full name and email address set to allow Renovate to establish Git identity, or the `gitAuthor` config option should be set.

### If you do not set `username` or `gitAuthor`

If you don't set `username` or `gitAuthor`, then you must use the user scope.
User scopes need Gitea `v1.19` or higher.

The user scope must have these permissions:

- `repo`
- `read:user` and `read:email`

If you use Gitea packages, add the `read:packages` scope.

## Unsupported platform features/concepts

- **Adding reviewers to PRs not supported**: Gitea versions older than `v1.14.0` lack the required API
- **Setting `platformAutomerge` to use platform-native automerge for PRs not supported**: Gitea versions older than `v1.17.0` lack the required API
- **Git upload filters**: If you're using a Gitea version older than `v1.16.0` then you must enable [clone filters](https://docs.gitea.io/en-us/clone-filters/)

## Features awaiting implementation

- none

## Repo autodiscover sorting

You can change the default server-side sort method and order for autodiscover API.
Set those via [`RENOVATE_X_AUTODISCOVER_REPO_SORT`](https://docs.renovatebot.com/self-hosted-experimental/#renovate_x_autodiscover_repo_sort) and [`RENOVATE_X_AUTODISCOVER_REPO_ORDER`](https://docs.renovatebot.com/self-hosted-experimental/#renovate_x_autodiscover_repo_order).
Read the [Gitea swagger docs](https://try.gitea.io/api/swagger#/repository/repoSearch) for more details.
