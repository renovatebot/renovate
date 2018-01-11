---
date: 2017-07-12
title: GitHub App Installation
categories:
  - getting-started
description: How to install the Renovate GitHub App
type: Document
order: 1
---

Installing/Enabling the Renovate GitHub App is fairly simple, and no different to any other GitHub App.

First, navigate to [https://github.com/apps/renovate](https://github.com/apps/renovate) and click the Install button:

![Github App Install button](/images/screenshots/github-app-install.png)

The only choice you need to make is whether to run Renovate on:

![Github App repositories](/images/screenshots/github-app-install-repositories.png)

Renovate will silently ignore any repositories that don't have a `package.json` file, however most people choose to select which repositories to include. Unfortunately GitHub doesn't yet offer the chance to "select all but exclude some" so instead you need to select all that you want. The form also requires you to start typing before it suggests to you repositories, which is a bit of a pain.

Once you're done selecting repositories for Renovate to run on, click the green Install button at the bottom of the page and Renovate will be enabled for those repositories and start the onboarding process.
