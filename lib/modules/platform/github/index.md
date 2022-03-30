# GitHub and GitHub Enterprise

## Authentication

First, [create a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for the bot account (select "repo" scope).
Configure it either as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.

If you use GitHub Enterprise Server then `endpoint` must point to `https://github.enterprise.com/api/v3/`.
You can choose where you want to set `endpoint`:

- In your `config.js` file
- In a environment variable
- In a CLI parameter

## Running as a GitHub App

Instead of a bot account with a Personal Access Token you can run `renovate` as a self-hosted [GitHub App](https://docs.github.com/en/developers/apps/getting-started-with-apps).

When creating the GitHub App give it the following permissions:

- Checks: Read & write
- Contents: Read & write
- Issues: Read & write
- Metadata: Read-only
- Pull requests: Read & write
- Commit statuses: Read & write
- Dependabot alerts: Read-only
- Workflows: Read & write
- Members: Read

Other values like Homepage URL, User authorization callback URL and webhooks can be disabled or filled with dummy values.

Inside your `config.js` you need to set the following values, assuming the name of your app is `self-hosted-renovate`:

**`username:"self-hosted-renovate[bot]"`**

The slug name of your app with `[bot]` appended

**`gitAuthor:"Self-hosted Renovate Bot <123456+self-hosted-renovate[bot]@users.noreply.github.enterprise.com>"`**

The [GitHub App associated email](https://github.community/t/logging-into-git-as-a-github-app/115916/2) to match commits to the bot.
It needs to have the user id _and_ the username followed by the `users.noreply.`-domain of either github.com or the GitHub Enterprise Server.
A way to get the user id of a GitHub app is to [query the user API](https://docs.github.com/en/rest/reference/users#get-a-user) at `api.github.com/user/self-hosted-renovate[bot]` (github.com) or `github.enterprise.com/api/v3/uer/self-hosted-renovate[bot]` (GitHub Enterprise Server).

**`token:"x-access-token:${github-app-installation}"`**

The token needs to be prefixed with `x-access-token` and be a [GitHub App Installation token](https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation).

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
