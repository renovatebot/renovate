---
title: Azure DevOps setup
description: How to setup Renovate for Azure DevOps
---

# Azure DevOps setup

This document explains how to setup Renovate for use on Azure DevOps.

## Setting up a new pipeline

Create a brand new pipeline within Azure DevOps, and select your source.
![Azure DevOps create new pipeline](assets/images/azure-devops-setup-1.png)

Select your repository.

Within _Configure your pipeline_ select: **Starter pipeline file**
![Azure DevOps starter pipeline template](assets/images/azure-devops-setup-2.png)

Replace all content in the starter pipeline with:

```yaml
schedules:
  - cron: '0 3 * * *'
    displayName: 'Every day at 3am'
    branches:
      include: [master]

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

Add a file named `.npmrc` to your repository with the following contents.
Note: replace `YOUR-ORG` with your Azure DevOps organization and `YOUR-FEED` with your Azure Artifacts feed.

```json
registry=https://pkgs.dev.azure.com/YOUR-ORG/_packaging/YOUR-FEED/npm/registry/
always-auth=true
```

## Create a config.js file

Add a file named `config.js` to your repository with the following contents.
Note: replace `YOUR-ORG` with your Azure DevOps organization and `YOUR-PROJECT/YOUR-REPO` with your Azure DevOps project and repository.

```javascript
module.exports = {
  platform: 'azure',
  endpoint: 'https://dev.azure.com/YOUR-ORG/',
  token: process.env.TOKEN,
  hostRules: [
    {
      hostName: 'pkgs.dev.azure.com',
      username: 'apikey',
      password: process.env.TOKEN,
    },
  ],
  repositories: ['YOUR-PROJECT/YOUR-REPO'],
};
```

### Add renovate.json file

Additionally, you can add `renovate.json` with Renovate configurations in the root of the repo.
[Read more about configuration options](https://docs.renovatebot.com/configuration-options/)

### Using a single pipeline to update multiple repositories

If you want to use a single Renovate pipeline to update multiple repositories you need to take the following steps.

Add the names of the repositories to `config.js`.
Make sure that the "Project Collection Build Service (YOUR-PROJECT)" user has the following permissions on the repositories:

- Contribute
- Contribute to pull requests
- Create branch
