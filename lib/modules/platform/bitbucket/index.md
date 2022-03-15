# Bitbucket Cloud

## Authentication

First, [create an AppPassword](https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/) for the bot account.
Give the bot App password the following permission scopes:

- [`account`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#account) (Account: Read)
- [`team`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#team) (Workspace membership: Read)
- [`issue:write`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#issue-write) (Issues: Write)
- [`pullrequest:write`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#pullrequest-write) (Pull requests: Write)

The bot also needs to be able to validate the workspace membership status of pull-request reviewers, for that, [create a new user group](https://support.atlassian.com/bitbucket-cloud/docs/organize-workspace-members-into-groups/) in the workspace with the **Create repositories** permission and add the bot user to it.

Configure it as `password` in your `config.js` file, or in environment variable `RENOVATE_PASSWORD`, or via CLI `--password=`.
Also be sure to configure the `username` for your bot account.
Don't forget to configure `platform=bitbucket` somewhere in config.

## Unsupported platform features/concepts

- Adding assignees to PRs not supported (does not seem to be a Bitbucket concept)
- `automergeStrategy=rebase` not supported by BitBucket Cloud, see [Jira issue BCLOUD-16610](https://jira.atlassian.com/browse/BCLOUD-16610)

## Features requiring implementation

- Creating issues not implemented yet, e.g. when there is a config error
- Adding comments to PRs not implemented yet, e.g. when a PR has been edited or has a lockfile error
