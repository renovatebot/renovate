# Bitbucket Cloud

## Authentication

First, [create an app password](https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/) for the bot account.
Give the bot app password the following permission scopes:

| Permission                                                                                           | Scope                      |
| ---------------------------------------------------------------------------------------------------- | -------------------------- |
| [`account`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#account)                     | Account: Read              |
| [`team`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#team)                           | Workspace membership: Read |
| [`issue:write`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#issue-write)             | Issues: Write              |
| [`pullrequest:write`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#pullrequest-write) | Pull requests: Write       |

The bot also needs to validate the workspace membership status of pull-request reviewers, for that, [create a new user group](https://support.atlassian.com/bitbucket-cloud/docs/organize-workspace-members-into-groups/) in the workspace with the **Create repositories** permission and add the bot user to it.

Let Renovate use your app password by doing _one_ of the following:

- Set your app password as a `password` in your `config.js` file
- Set your app password as an environment variable `RENOVATE_PASSWORD`
- Set your app password when you run Renovate in the CLI with `--password=`

Remember to:

- Set the `username` for the bot account
- Set `platform=bitbucket` somewhere in your Renovate config file

## Unsupported platform features/concepts

- Adding assignees to PRs not supported (does not seem to be a Bitbucket concept)
- `automergeStrategy=rebase` not supported by Bitbucket Cloud, see [Jira issue BCLOUD-16610](https://jira.atlassian.com/browse/BCLOUD-16610)
