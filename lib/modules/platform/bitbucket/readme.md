# Bitbucket Cloud

Most of the information on this page is meant for users who want to self-host Renovate on Bitbucket Cloud.

## Easiest way to run Renovate

For most users, the easiest way to get started is to install [the Mend app for Bitbucket](https://marketplace.atlassian.com/apps/1232072/mend?tab=overview&hosting=cloud) and use the free Renovate plan.
When you use the app, Mend will:

- authenticate the app to Bitbucket Cloud
- keep the tokens safe
- maintain and update the Renovate version used

If you self-host Renovate you must do the things listed above yourself.
Self-hosting is meant for users with advanced use cases, or who want to be in full control of the bot and the environment it runs in.
We recommend most users install the Mend app.

Read the [Security and Permissions](../../../security-and-permissions.md) page to learn about the Security and Permissions needed for the Mend app.

After you installed the hosted app, please read the [reading list](../../../reading-list.md) to learn how to use and configure Renovate.

## Authentication

### Recommended: Workspace Access Tokens

**We recommend using [Workspace Access Tokens](https://support.atlassian.com/bitbucket-cloud/docs/workspace-access-tokens/)** instead of personal access tokens.
Workspace Access Tokens provide higher API rate limits than personal access tokens, which is important for repositories with many dependencies.

Create a Workspace Access Token with the following permission scopes:

| Scopes               |
| -------------------- |
| Account: Read        |
| Repository: Read     |
| Repository: Write    |
| Pull Requests: Read  |
| Pull Requests: Write |

Let Renovate use your Workspace Access Token by doing _one_ of the following:

- Set your token as an environment variable `RENOVATE_TOKEN`
- Set your token when you run Renovate in the CLI with `--token=`
- Set your token as a `token` in your `config.js` file

### Alternative: Personal Access Tokens

If you prefer to use a personal access token, [create an API token](https://support.atlassian.com/bitbucket-cloud/docs/create-an-api-token/) for the bot account with the following scopes:

Note: if you're only using a Personal Access Token for Dependency Dashboard issues you can restrict this further.

| Permission                                                                                                               | Scope                |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| [`read:repository:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#read-repository-bitbucket)     | Repository: Read     |
| [`write:repository:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#write-repository-bitbucket)   | Repository: Write    |
| [`read:pullrequest:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#read-pullrequest-bitbucket)   | Pull requests: Read  |
| [`write:pullrequest:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#write-pullrequest-bitbucket) | Pull requests: Write |
| [`read:user:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#read-user-bitbucket)                 | User: Read           |
| [`read:issue:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#read-issue-bitbucket)               | Issues: Read         |
| [`write:issue:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#write-issue-bitbucket)             | Issues: Write        |
| [`read:workspace:bitbucket`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#read-workspace-bitbucket)       | Workspace: Read      |

The bot also needs to validate the workspace membership status of pull-request reviewers, for that, [create a new user group](https://support.atlassian.com/bitbucket-cloud/docs/organize-workspace-members-into-groups/) in the workspace with the **Create repositories** permission and add the bot user to it.

Let Renovate use your personal API token by doing _one_ of the following:

- Set your API token as a `password` in your `config.js` file
- Set your API token as an environment variable `RENOVATE_PASSWORD`
- Set your API token when you run Renovate in the CLI with `--password=`

Remember to:

- Set the `username` for the bot account, which is your Atlassian account email. You can find your email through "Personal Bitbucket settings" on the "Email aliases" page for your account
- Set `platform=bitbucket` somewhere in your Renovate config file

### Authentication Flow

Renovate uses different authentication methods depending on the API endpoint:

- **For `/issues` endpoints**: When both `username`+`password` and `token` are provided, Renovate will prefer username+password authentication (Basic auth) for issues-related API calls
- **For all other endpoints**: When a `token` is available, Renovate will use Bearer token authentication

This hybrid approach ensures compatibility with Bitbucket Cloud's API requirements while maximizing the benefits of higher rate limits when using Workspace Access Tokens.

## Unsupported platform features/concepts

- Adding assignees to PRs not supported (does not seem to be a Bitbucket concept)
- `automergeStrategy=rebase` not supported by Bitbucket Cloud, see [Jira issue BCLOUD-16610](https://jira.atlassian.com/browse/BCLOUD-16610)
- Markdown support for collapsible syntax, see [Jira issue BCLOUD-20231](https://jira.atlassian.com/browse/BCLOUD-20231)
