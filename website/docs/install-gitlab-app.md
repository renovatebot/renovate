---
title: GitLab App Installation
description: How to install the Renovate GitLab App
---

# GitLab App Installation

### Overview

Renovate runs as the user [@renovate-bot](https://gitlab.com/renovate-bot) on [gitlab.com](https://gitlab.com). To enable the hosted Renovate App on your GitLab.com project, you can do any of the following:

- Add [@renovate-bot](https://gitlab.com/renovate-bot) as a Developer directly to each project, or
- Add [@renovate-bot](https://gitlab.com/renovate-bot) to a team that has Developer access to the project
- Install using the Renovate Dashboard's UI

### Dashboard

First, sign into the [Dashboard](https://renovatebot.com/dashboard) using GitLab OAuth.

![Renovate Dashboard Sign In Screenshot](assets/images/dashboard-login.png)

The sidebar will load a list of any already-installed repositories that you have access to, if there are any.

Now click the "Settings" icon ![Renovate Dashboard Settings icon](assets/images/dashboard-settings.png) at the top of the side bar and it will soon load a list of all GitLab.com repositories that you have admin rights to.

![Renovate Dashboard Install Screen](assets/images/dashboard-install.png)

On this screen, toggle the switch to install Renovate into a repo. Doing so will:

- Add [@renovate-bot](https://gitlab.com/renovate-bot) as a Developer to the project
- Add a webhook to the project to send events to the Renovate webhook handler

### Webhooks

One of the best aspects of the hosted Renovate App compared to the CLI version is the responsiveness gained from supporting webhooks, such as:

- Detecting commits to master and checking for any MR conflicts that need to be rebased
- Allowing manual rebase requests from any MR

If you have added [@renovate-bot](https://gitlab.com/renovate-bot) to a repository or team manually rather than through the Dashboard UI then you _won't_ yet have a webhook.
To add webhooks for all missing projects, simply log into the Dashboard and load the Install/Uninstall screen using the instructions above.
Whenever that screen is loaded, the Dashboard client will check every installed project for webhooks and install Renovate's webhook if necessary.

### Pricing

The Renovate App is currently free for all GitLab projects. Later, charging for private repositories will be added and probably at the same pricing tiers as [the GitHub App](https://github.com/marketplace/renovate). We will provide at least one month's notice before implementing paid plans for private repositories. Public repositories will remain free.

### Details and Known Limitations

##### Credentials storage

The Renovate App does not need to store user OAuth2 tokens - all regular access to gitlab.com is done using the token of [@renovate-bot](https://gitlab.com/renovate-bot).
User tokens are passed with API calls to Renovate's backend to verify identity but never logged or cached.

##### Installing for all projects

Unlike on GitHub, it is not possible to have the option to install Renovate on "all repositories now and in the future". To do this would require Renovate to store the user's token and this is not something we want to do.

##### Detecting new projects

Currently there is no detection mechanism in the backend scheduler to determine when Renovate has been added to a new project, so the onboarding MR won't appear instantly. Instead, the new project should be picked up during hourly scheduled runs.
