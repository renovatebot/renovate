# GitHub and GitHub Enterprise Server

## Authentication

First, create a [fine-grained](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) _or_ a [classic](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-personal-access-token-classic) PAT.
The PAT must have the `repo` scope.
If you want Renovate to also update your GitHub Action files, you must grant the `workflow` scope.

Read the [GitHub Docs, about Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#about-personal-access-tokens) to learn more about PATs.

Let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

Remember to set `platform=github` somewhere in your Renovate config file.

If you use GitHub Enterprise Server then `endpoint` must point to `https://github-enterprise.example.com/api/v3/`.
You can choose where you want to set `endpoint`:

- In your `config.js` file
- In a environment variable
- In a CLI parameter

<!-- prettier-ignore -->
!!! tip "Labels and forking mode"
    If you're self-hosting Renovate on GitHub.com with GitHub Actions in forking mode, and want Renovate to apply labels then you must give the PAT `triage` level rights on `issues`.
    The `triage` level allows the PAT to apply/dismiss existing labels.

## Running using a fine-grained token

### Permissions

A fine-grained token must have these permissions:

| Permission          | Access           | Level                          |
| ------------------- | ---------------- | ------------------------------ |
| `Members`           | `Read-only`      | _Organization_                 |
| `Commit statuses`   | `Read and write` | _Repository_ or _Organization_ |
| `Contents`          | `Read and write` | _Repository_ or _Organization_ |
| `Dependabot alerts` | `Read-only`      | _Repository_ or _Organization_ |
| `Issues`            | `Read and write` | _Repository_ or _Organization_ |
| `Pull requests`     | `Read and write` | _Repository_ or _Organization_ |
| `Workflows`         | `Read and write` | _Repository_ or _Organization_ |

<!-- prettier-ignore -->
!!! tip "Use a bot role account"
    Consider creating a GitHub App to use instead of using your own GitHub user account.

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
| Administration    | `read`           |
| Dependabot alerts | `read`           |
| Members           | `read`           |
| Metadata          | `read`           |

Other values like Homepage URL, User authorization callback URL and webhooks can be disabled or filled with dummy values.

Inside your `config.js` you need to set the following values, assuming the name of your app is `self-hosted-renovate`:

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

<!-- prettier-ignore -->
!!! tip "Third-party tools to regenerate installation tokens"
    If you're self-hosting Renovate within a GitHub Actions workflow, then you can use the [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token) action.
    If you use Node.js/CLI, then you can use the [`github-app-installation-token`](https://github.com/gagoar/github-app-installation-token) package.
    If you use Docker, then you can use the [`mshekow/github-app-installation-token`](https://github.com/MShekow/github-app-installation-token) image.

**`repositories: ["orgname/repo-1","orgname/repo-2"]`**

List of repositories to run on.
Alternatively as comma-separated environment variable `RENOVATE_REPOSITORIES`.
The GitHub App installation token is scoped at most to a single organization and running on multiple organizations requires multiple invocations of `renovate` with different `token` and `repositories` parameters.

**`username:"self-hosted-renovate[bot]"`** (optional, autodetected if not supplied)

The slug name of your app with `[bot]` appended

**`gitAuthor:"Self-hosted Renovate Bot <123456+self-hosted-renovate[bot]@users.noreply.github.enterprise.com>"`** (optional, autodetected if not supplied)

The [GitHub App associated email](https://github.community/t/logging-into-git-as-a-github-app/115916/2) to match commits to the bot.
It needs to have the user id _and_ the username followed by the `users.noreply.`-domain of either github.com or the GitHub Enterprise Server.
A way to get the user id of a GitHub app is to [query the user API](https://docs.github.com/en/rest/reference/users#get-a-user) at `api.github.com/users/self-hosted-renovate[bot]` (github.com) or `github.enterprise.com/api/v3/users/self-hosted-renovate[bot]` (GitHub Enterprise Server).

## Package Registry Credentials

When Renovate runs against repositories on `github.com`, and the environment variable `RENOVATE_X_GITHUB_HOST_RULES` is set, then Renovate automatically provisions `hostRules` for these GitHub Packages registries using the platform token:

- `ghcr.io`
- `maven.pkg.github.com`
- `npm.pkg.github.com`
- `nuget.pkg.github.com`
- `rubygems.pkg.github.com`

<!-- prettier-ignore -->
!!! warning
    We reverted the Package Registry Credentials feature to experimental mode, because users reported it's not working correctly with app tokens.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the GitHub repository itself, and this cannot be overridden yet
