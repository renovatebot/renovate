# Forgejo

Renovate supports [Forgejo](https://forgejo.org).

## Authentication

First, [create a Personal Access Token (PAT)](https://forgejo.org/docs/latest/user/api-usage/#authentication) for the bot account.
The bot account should have full name and email address configured.
Then let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

You must set `platform=forgejo` in your Renovate config file.

The PAT should have these permissions:

| Scope          | Permission       | Valid for Forgejo versions     | Notes                         |
| -------------- | ---------------- | ------------------------------ | ----------------------------- |
| `repo`         | `Read and Write` | all                            |                               |
| `user`         | `Read`           | all                            |                               |
| `issue`        | `Read and Write` | `>= 1.20.0`                    |                               |
| `organization` | `Read`           | `>= 1.20.0`                    | Required to read group labels |
| `email`        | `Read`           | `<= 1.19.3`                    |                               |
| `misc`         | `Read`           | Only for `1.20.0` and `1.20.1` |                               |

If you use Forgejo packages, add the `read:packages` scope.

## Unsupported platform features/concepts

- **`platformAutomerge` (`true` by default) for platform-native automerge not supported**: Forgejo versions older than v10.0.0 don't support required branch autodelete for automerge.

## Features awaiting implementation

- none

## Repo autodiscover

Renovate can discover repositories on Forgejo using the `autodiscover` feature.
Repositories are ignored when one of the following conditions is met:

- The repository is a `mirror`
- We do not have push or pull permissions to that repository
- Pull requests are disabled for that repository

You can change the default server-side sort method and order for autodiscover API.
Set those via [`autodiscoverRepoSort`](../../../self-hosted-configuration.md#autodiscoverreposort) and [`autodiscoverRepoOrder`](../../../self-hosted-configuration.md#autodiscoverrepoorder).
Read the [Forgejo swagger docs](https://code.forgejo.org/api/swagger#/repository/repoSearch) for more details.
