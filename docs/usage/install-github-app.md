---
title: GitHub App installation
description: How to install the Renovate GitHub App
---

# GitHub app installation

Installing/enabling the Renovate GitHub App is simple.

First, navigate to [https://github.com/apps/renovate](https://github.com/apps/renovate) and click the Install button:

![Github App Install button](assets/images/github-app-install.png)

The only choice you need to make is whether to run Renovate on all repositories or on selected repositories:

![Github App repositories](assets/images/github-app-choose-repos.png)

Renovate will ignore any repositories that don't have known package files, as well as any forks, so you can enable Renovate for all your repositories with no problems.
That said, most people run Renovate on selected repositories.
Unfortunately GitHub doesn't offer a "select all except X,Y,Z" option, so you must select each repository where you want Renovate to run.

Once you're done selecting repositories for Renovate to run on, click the green Install button at the bottom of the page and Renovate will be enabled for those repositories and start the onboarding process.
