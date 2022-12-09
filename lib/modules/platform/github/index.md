# GitHub and GitHub Enterprise Server

## Authentication

First, [create a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for the bot account, select `repo` scope.

Let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

Remember to set `platform=github` somewhere in your Renovate config file.

If you use GitHub Enterprise Server then `endpoint` must point to `https://github.enterprise.com/api/v3/`.
You can choose where you want to set `endpoint`:

- In your `config.js` file
- In a environment variable
- In a CLI parameter

## Running as a GitHub App

Instead of a bot account with a Personal Access Token you can run `renovate` as a self-hosted [GitHub App](https://docs.github.com/en/developers/apps/getting-started-with-apps).

When creating the GitHub App give it the following permissions:

| Permission        | Scope            |
| ----------------- | ---------------- |
| Checks            | `read` + `write` |
| Commit statuses   | `read` + `write` |
| Contents          | `read` + `write` |
| Issues            | `read` + `write` |
| Pull requests     | `read` + `write` |
| Workflows         | `read` + `write` |
| Dependabot alerts | `read`           |
| Members           | `read`           |
| Metadata          | `read`           |

Other values like Homepage URL, User authorization callback URL and webhooks can be disabled or filled with dummy values.

Inside your `config.js` you need to set the following values, assuming the name of your app is `self-hosted-renovate`:

**`username:"self-hosted-renovate[bot]"`**

The slug name of your app with `[bot]` appended

**`gitAuthor:"Self-hosted Renovate Bot <123456+self-hosted-renovate[bot]@users.noreply.github.enterprise.com>"`**

The [GitHub App associated email](https://github.community/t/logging-into-git-as-a-github-app/115916/2) to match commits to the bot.
It needs to have the user id _and_ the username followed by the `users.noreply.`-domain of either github.com or the GitHub Enterprise Server.
A way to get the user id of a GitHub app is to [query the user API](https://docs.github.com/en/rest/reference/users#get-a-user) at `api.github.com/users/self-hosted-renovate[bot]` (github.com) or `github.enterprise.com/api/v3/users/self-hosted-renovate[bot]` (GitHub Enterprise Server).

**`token:"ghs_123exampletoken"`**

You must use a [GitHub App Installation token](https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation).

Previously, the token had to be prefixed with `x-access-token:`.
We recommend you replace any prefixed tokens with normal tokens.
We will drop support for prefixed tokens in the future.

Any tokens that do not start with `ghs_` (for example tokens from GitHub Enterprise Server versions before version `3.2`) must be prefixed with `x-access-token:`.

<!-- prettier-ignore -->
!!! note
    The installation tokens expire after 1 hour and need to be regenerated regularly.
    Alternatively as environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.

**`repositories: ["orgname/repo-1","orgname/repo-2"]`**

List of repositories to run on.
Alternatively as comma-separated environment variable `RENOVATE_REPOSITORIES`.
The GitHub App installation token is scoped at most to a single organization and running on multiple organizations requires multiple invocations of `renovate` with different `token` and `repositories` parameters.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the GitHub repository itself, and this cannot be overridden yet
