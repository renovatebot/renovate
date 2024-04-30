---
title: Dependency Dashboard
description: Learn all about Renovate's Dependency Dashboard
---

# Introduction

Renovate has a Dependency Dashboard that shows an overview of the state of your repositories' dependencies.

When the Dependency Dashboard is enabled, Renovate will create a new issue in the repository.
This issue has a "dashboard" where you can get an overview of the status of all updates.

Having the Dependency Dashboard also enables the concept of an "approval" workflow for new upgrades, either for selected dependencies (recommended) or even for all.

## Supported platforms

The Dependency Dashboard requires that the host platforms supports the concept of issues with dynamic Markdown checkboxes.
Read [our FAQ, Renovate core features not supported on all platforms](../faq.md#renovate-core-features-not-supported-on-all-platforms) to see if your platform can use the Dependency Dashboard feature.

## How to enable the dashboard

To turn on the Dashboard manually, add the `:dependencyDashboard` preset to your `extends` array in the Renovate configuration file:

```json
{
  "extends": ["config:recommended", ":dependencyDashboard"]
}
```

Or set `dependencyDashboard` to `true`:

```json
{
  "dependencyDashboard": true
}
```

## How to disable the dashboard

To disable the Dependency Dashboard, add the preset `:disableDependencyDashboard` or set `dependencyDashboard` to `false`.

```json
{
  "extends": ["config:recommended", ":disableDependencyDashboard"]
}
```

## Use cases

This section explains some common use cases where having the Dependency Dashboard can help.

### Visibility into rejected/deferred updates

Renovate's Dependency Dashboard shows an overview of all updates that are still "to do".

If you close an update PR from Renovate without merging, the Dashboard will list this update in the Closed/Ignored section.
If you later change your mind about the update, you can get a new PR by selecting the corresponding checkbox on the dashboard.

### Dependency Dashboard Approval workflow

Sometimes you want Renovate to wait for your approval before creating an update PR.
You can customize this "wait for approval" behavior however you like best.

At a high level the options are:

- Require approval for _all_ updates
- Require approval for a type of updates (`major` for example)
- Require approval for specific packages

You can mix and match these options as well.

#### Require approval for all updates

We do not recommend that you require approval for _all_ updates.
When you require prior approval, you need to check the dashboard issue regularly to check for important updates.
You'll probably forget to check often enough, and out of sight means out of mind!

Maybe you find Renovate too noisy, and want to opt-out of getting automatic updates whenever they're ready.

In this case, you can tell Renovate to wait for your approval before making any pull requests.
This means that you have full control over when you get updates.

But vulnerability remediation PRs will still get created immediately without requiring approval.

To require manual approval for _all updates_, add the `:dependencyDashboardApproval` presets to the `extends` array in your Renovate configuration file:

```json
{
  "extends": ["config:recommended", ":dependencyDashboardApproval"]
}
```

#### Require approval for major updates

Major updates often have breaking changes which require manual changes in your code before they can be merged.
So maybe you only want to get major updates when you have sufficient time to check them carefully.

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
      "matchPackagePatterns": ["^@somescope"],
      "dependencyDashboardApproval": true
    }
  ]
}
```
