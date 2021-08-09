---
title: Dependency Dashboard
description: Learn all about Renovate's Dependency Dashboard
---

# Introduction

Renovate has a Dependency Dashboard that shows a overview of the state of your repositories' dependencies.

When you turn on the Dependency Dashboard, Renovate will create a new issue on the repository.
This issue contains a "dashboard" where you can get a overview of the status of all updates.

Having the Dependency Dashboard enabled also allows you to opt-in to different behavior for certain or even all updates with the "Dependency Dashboard Approval" workflow.

## Supported platforms

The Dependency Dashboard requires that the host platforms supports the concept of issues.
Read [our FAQ, Renovate core features not supported on all platforms](https://docs.renovatebot.com/faq/#renovate-core-features-not-supported-on-all-platforms) to see if your platform can use the Dependency Dashboard feature.

## How to enable the dashboard

<!-- TODO: It might be nice to change our config presets, so we have one to `:enableDependencyDashboard` and one to `:disableDependencyDashboard`. -->

To turn on the Dashboard manually, add the `:dependencyDashboard` preset to your `extends` array in the Renovate configuration file:

```json
{
  "extends": ["config:base", ":dependencyDashboard"]
}
```

Or set `dependencyDashboard` to `true`:

```
{
  "dependencyDashboard": true
}
```

<!--
TODO: discuss whether we need to change things.

https://docs.renovatebot.com/configuration-options/#dependencydashboardapproval
says to set `dependencyDashboardApproval` to `true`, but we also have the `:dependencyDashboard`, which is not mentioned in the link.

-->

## How to disable the dashboard

<!-- TODO: It might be nice to change our config presets, so we have one to `:enableDependencyDashboard` and one to `:disableDependencyDashboard`. -->

To disable the Dependency Dashboard, set `dependencyDashboard` to `false`.

```json
{
  "extends": ["config:base"],
  "dependencyDashboard": false
}
```

## Usecases

This section explains some common usecases where having the Dependency Dashboard can help.

### Visibility into rejected/deferred updates

Renovate's Dependency Dashboard shows a overview of all updates that are still "to do".

If you close a update PR from Renovate, the Dashboard will list this update.
If you later change your mind about the update, you can get a new PR by clicking the corresponding checkbox on the dashboard.

### Show errored out updates

<!-- TODO: Not sure if showing errored updates/branches require the dashboard? Do we open a new issue to warn about a branch error? -->

### Dependency Dashboard Approval workflow

Sometimes you want Renovate to wait for your approval before creating a update PR.
You can customize this "wait for approval" behavior however you like best.

At a high level the options are:

- Require approval for _all_ updates
- Require approval for a type of updates (`major` for example)
- Require approval for specific packages

You can mix and match these options as well.

#### Require approval for all updates

We do not recommend that you require approval for _all_ updates.
When you require prior approval, you need to check the dashboard issue regularly to check for important updates.
You'll probably forgot to check often enough, out of sight is out of mind!

Maybe you find Renovate too noisy, and want to opt-out of getting automatic updates whenever they're ready.

In this case, you can tell Renovate to wait for your approval before making any pull requests.
This means that you have full control over when you get updates.

<!-- TODO: question: do you still get security updates when you tell Renovate to wait for approval for all updates? -->

Make sure you explictly enable the Dependency Dashboard this way have visibility into all pending updates.

To require manual approval for _all updates_, add the `:dependencyDashboard` and the `:dependencyDashboardApproval` presets to the `extends` array in your Renovate configuration file:

```json
{
  "extends": [
    "config:base",
    ":dependencyDashboard",
    ":dependencyDashboardApproval"
  ]
}
```

#### Require approval for major updates

Major updates are likely to break tests and/or require manual work before they can be merged.
So maybe you only want to get major updates when you approve them.

Dependency Dashboard Approval is far superior to disabling major updates because at least you can fully see what's pending on the dashboard, instead of updates being totally invisible.

If you want to require approval for major updates, set `dependencyDashboardApproval` to `true` within a `major` object:

```json
{
  "major": {
    "dependencyDashboardApproval": true
  }
}
```

#### Require approval for specific packages

Sometimes you only want to update specific packages when you say so.

Maybe a package doesn't follow Semantic Versioning, and has breaking changes on every new release, so you want to update on your terms.

Or maybe you have a package that updates too rapidly for you to keep up with, and you want to update once in a while manually.

If you want to approve specific packages, set `dependencyDashboardApproval` to `true` within a `packageRules` entry where you have defined a specific package or pattern.

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^@package-name"],
      "dependencyDashboardApproval": true
    }
  ]
}
```
