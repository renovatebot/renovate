---
title: Managers
---

# Managers

Renovate is based around the concept of "package managers", or "managers" for short.
These range from traditional package managers like npm, Bundler and Composer through to less traditional concepts like CircleCI or Travis config files.

The goal of Renovate is to detect and maintain all third-party dependencies in your repositories, through the use of managers.

## Supported Managers

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->

## Configuring Managers

### File Matching

Most managers have a default `fileMatch` array.
The `fileMatch` array has regular expression strings that match against the repository file list.

#### Managers with no default fileMatch

Some managers have no default `fileMatch` regular expression, because they have no filename convention that would let Renovate intelligently filter them.
In such a case, the manager will be disabled until you create a `fileMatch` regular expression, e.g. like the following:

```json
{
  "kubernetes": {
    "fileMatch": ["^config/.*\\.yaml$"]
  }
}
```

#### Extending a manager's default fileMatch

If the default `fileMatch` regular expression for a manager does not match against one of your relevant files, you can _extend_ the existing regular expression(s) by configuring a manager's `fileMatch` like in this example:

```json
{
  "dockerfile": {
    "fileMatch": ["does-not-look-like-a-docker-file"]
  }
}
```

#### Ignoring files that match the default fileMatch

Renovate will _extend_ the existing [`fileMatch`](../../configuration-options.md#filematch), meaning you don't need to include the default regular expressions like `Dockerfile` in your own array.
In other words, the regular expression are "additive".
If a manager matches a file that you _don't_ want it to, ignore it using the [`ignorePaths`](../../configuration-options.md#ignorepaths) configuration option.
Also, if you ever find that Renovate is _not_ matching a file name that you're certain it should, check your preset config isn't the cause of it.
The `config:recommended` preset ignores common test and example directory names, for example.

### Enabling and disabling managers

#### Enabling experimental managers

Most managers are enabled by default.
For those that aren't, typically because they are considered experimental, you can opt-in manually.
If there was a manager called `some-new-manager` you would enable it like this:

```json
{
  "some-new-manager": {
    "enabled": true
  }
}
```

#### Disabling managers

```json title="Example of disabling a specific manager (gradle)"
{
  "gradle": {
    "enabled": false
  }
}
```

Please check the [list of supported managers](#supported-managers).

#### Limiting enabled managers

Say you only want to use Renovate for JavaScript packages, and to update your Dockerfile, and don't want any other updates.
You can use the `enabledManagers` array, to list the managers you want to use (`npm`, `dockerfile`):

```json
{
  "enabledManagers": ["npm", "dockerfile"]
}
```

Using the `enabledManagers` array disables all other managers, this includes Bundler, Composer, Docker Compose, etc.
