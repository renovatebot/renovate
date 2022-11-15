# Azure DevOps and Azure DevOps Server

## Authentication

First, [create a Personal Access Token](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=preview-page) for the bot account.
Let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

Remember to set `platform=azure` somewhere in your Renovate config file.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will use the merge strategy configured in the Azure Repos repository itself, and this cannot be overridden yet

## Running Renovate in Azure Pipelines

### Setting up a new pipeline

Create a brand new pipeline within Azure DevOps, and select your source:
![Azure DevOps create new pipeline](/assets/images/azure-devops-setup-1.png){ loading=lazy }

Then select your repository.

Within _Configure your pipeline_ select: **Starter pipeline**
![Azure DevOps starter pipeline template](/assets/images/azure-devops-setup-2.png){ loading=lazy }

Replace _all_ content in the starter pipeline with:

```yaml
schedules:
  - cron: '0 3 * * *'
    displayName: 'Every day at 3am'
    branches:
      include: [main]
    always: true

trigger: none

pool:
  vmImage: ubuntu-latest

steps:
  - task: npmAuthenticate@0
    inputs:
      workingFile: .npmrc

  - bash: |
      git config --global user.email 'bot@renovateapp.com'
      git config --global user.name 'Renovate Bot'
      npx --userconfig .npmrc renovate
    env:
      TOKEN: $(System.AccessToken)
```

## Create a .npmrc file

Create a `.npmrc` file in your repository:

```ini
registry=https://pkgs.dev.azure.com/YOUR-ORG/_packaging/YOUR-FEED/npm/registry/
always-auth=true
```

For the `registry` key, replace `YOUR-ORG` with your Azure DevOps organization and `YOUR-FEED` with your Azure Artifacts feed.

## Create a config.js file

Create a `config.js` file in your repository:

```javascript
module.exports = {
  platform: 'azure',
  endpoint: 'https://dev.azure.com/YOUR-ORG/',
  token: process.env.TOKEN,
  hostRules: [
    {
      hostType: 'npm',
      matchHost: 'pkgs.dev.azure.com',
      username: 'apikey',
      password: process.env.TOKEN,
    },
  ],
  repositories: ['YOUR-PROJECT/YOUR-REPO'],
};
```

For the `endpoint` key, replace `YOUR-ORG` with your Azure DevOps organization.
For the `repositories` key, replace `YOUR-PROJECT/YOUR-REPO` with your Azure DevOps project and repository.

### Yarn users

To do a successful `yarn install` you need to match the URL of the registry fully.
Use the `matchHost` config option to specify the full path to the registry.

```javascript
module.exports = {
  platform: 'azure',
  endpoint: 'https://myorg.visualstudio.com/',
  token: process.env.TOKEN,
  hostRules: [
    {
      matchHost:
        'https://myorg.pkgs.visualstudio.com/_packaging/myorg/npm/registry/',
      token: process.env.TOKEN,
      hostType: 'npm',
    },
    {
      matchHost: 'github.com',
      token: process.env.GITHUB_COM_TOKEN,
    },
  ],
  repositories: ['YOUR-PROJECT/YOUR-REPO'],
};
```

Put this in your repository's `.npmrc` file:

```ini
registry=https://myorg.pkgs.visualstudio.com/_packaging/myorg/npm/registry/
always-auth=true
```

### Add renovate.json file

Additionally, you can create a `renovate.json` file (which holds the Renovate configuration) in the root of the repository you want to update.
[Read more about the Renovate configuration options](https://docs.renovatebot.com/configuration-options/)

### Using a single pipeline to update multiple repositories

If you want to use a single Renovate pipeline to update multiple repositories you must take the following steps.

Add the names of the repositories to `config.js`.
Make sure that the "Project Collection Build Service (YOUR-PROJECT)" user has the following permissions on the repositories:

- Contribute
- Contribute to pull requests
- Create branch
