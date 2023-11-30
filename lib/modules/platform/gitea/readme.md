# Gitea and Forgejo

Renovate supports [Gitea](https://gitea.io) and the [Forgejo](https://forgejo.org) fork.
Forgejo exists since `v1.18.0` and is currently fully compatible to Gitea.

## Authentication

First, [create a Personal Access Token (PAT)](https://docs.gitea.io/en-us/api-usage/#authentication) for the bot account.
The bot account should have full name and email address configured.
Then let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

You must set `platform=gitea` in your Renovate config file.

The PAT should have these permissions:

| Scope          | Permission       | Valid for Gitea versions       | Notes                         |
| -------------- | ---------------- | ------------------------------ | ----------------------------- |
| `repo`         | `Read and Write` | all                            |                               |
| `user`         | `Read`           | all                            |                               |
| `issue`        | `Read and Write` | `>= 1.20.0`                    |                               |
| `organization` | `Read`           | `>= 1.20.0`                    | Required to read group labels |
| `email`        | `Read`           | `<= 1.19.3`                    |                               |
| `misc`         | `Read`           | Only for `1.20.0` and `1.20.1` |                               |

If you use Gitea packages, add the `read:packages` scope.

## Unsupported platform features/concepts

- **Adding reviewers to PRs not supported**: Gitea versions older than `v1.14.0` do not have the required API.
- **`platformAutomerge` (`true` by default) for platform-native automerge not supported**: Gitea versions older than v1.17.0 do not have the required API.
- **Git upload filters**: If you're using a Gitea version older than `v1.16.0` then you must enable [clone filters](https://docs.gitea.io/en-us/clone-filters/).

## Features awaiting implementation

- none

## Repo autodiscover sorting

You can change the default server-side sort method and order for autodiscover API.
Set those via [`RENOVATE_X_AUTODISCOVER_REPO_SORT`](../../../self-hosted-experimental.md#renovate_x_autodiscover_repo_sort) and [`RENOVATE_X_AUTODISCOVER_REPO_ORDER`](../../../self-hosted-experimental.md#renovate_x_autodiscover_repo_order).
Read the [Gitea swagger docs](https://try.gitea.io/api/swagger#/repository/repoSearch) for more details.
