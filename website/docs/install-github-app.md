---
title: GitHub App Installation
description: How to install the Renovate GitHub App
---

# GitHub App Installation

Installing/Enabling the Renovate GitHub App is fairly simple, and no different to any other GitHub App.

First, navigate to [https://github.com/apps/renovate](https://github.com/apps/renovate) and click the Install button:

![Github App Install button](assets/images/github-app-install.png)

The only choice you need to make is whether to run Renovate on:

![Github App repositories](assets/images/github-app-choose-repos.png)

Renovate will silently ignore any repositories that don't have known package files, as well as any forks, so it's OK to install for all, however most people choose to select which repositories to include. Unfortunately GitHub doesn't yet offer a "select all except X,Y,Z" so instead you need to individually select all that you want if you don't choose the install into all repositories option.

Once you're done selecting repositories for Renovate to run on, click the green Install button at the bottom of the page and Renovate will be enabled for those repositories and start the onboarding process.
