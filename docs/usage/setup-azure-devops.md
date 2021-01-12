---
title: Azure DevOps setup
description: How to setup Renovate for Azure DevOps
---

# Azure DevOps setup

1. Create a brand new pipeline within Azure DevOps, and select your source
   ![Azure DevOps create new pipeline](assets/images/azure-devops-setup-1.png)
1. Select your repository
1. Within _Configure your pipeline_ select: **Starter pipeline file**
   ![Azure DevOps starter pipeline template](assets/images/azure-devops-setup-2.png)
1. Replace all contents with:

   ```
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
         cp .npmrc ~/.npmrc
         npx renovate
       env:
         TOKEN: $(System.AccessToken)
   ```

1. Add a file named `.npmrc` to your repository with the following contents:  
   (replacing `YOUR-ORG` with your Azure DevOps organization and `YOUR-FEED` with your Azure Artifacts feed)

   ```
   @enpowerx:registry=https://pkgs.dev.azure.com/YOUR-ORG/_packaging/YOUR-FEED/npm/registry/ 
   always-auth=true
   ```

1. Add a file named `config.js` to your repository with the following contents:  
   (replacing `YOUR-ORG` with your Azure DevOps organization and `YOUR-PROJECT/YOUR-REPO` with your Azure DevOps project and repository)

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
       }
     ],
     repositories: [
       'YOUR-PROJECT/YOUR-REPO'
     ]
   };
   ```

1. Additionally, you can add `renovate.json` with Renovate configurations in the root of the repo. [Read more about configurations options](https://docs.renovatebot.com/configuration-options/)

If you wish to use a single Renovate pipeline to update multiple repositories:

1. Add the names of the repositories to `config.js`.

1. Make sure that the "Project Collection Build Service" user has the following permissions on the repositores:
   - Contribute
   - Contribute to pull requests
   - Create branch
