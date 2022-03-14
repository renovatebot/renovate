# GitHub and GitHub Enterprise

## Authentication

First, [create a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for the bot account (select "repo" scope).
Configure it either as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.

For GitHub Enterprise Server set the `endpoint` in your `config.js` to `https://github.enterprise.com/api/v3/`.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the GitHub repository itself, and this cannot be overridden yet
