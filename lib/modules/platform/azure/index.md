# Azure DevOps and Azure DevOps Server

## Authentication

First, [create a Personal Access Token](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=preview-page) for the bot account.
Configure it either as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.
Don't forget to configure `platform=azure` somewhere in config.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the Azure Repos repository itself, and this cannot be overridden yet
