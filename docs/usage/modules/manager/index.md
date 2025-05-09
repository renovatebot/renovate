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

Most Renovate managers have a default `managerFilePatterns` array.
The `managerFilePatterns` array can hold a regular expression or glob pattern, that match against the repository file list.

#### Managers with no default managerFilePatterns

Some managers have no default `managerFilePatterns`, because they have no filename convention that would let Renovate intelligently filter them.
If there is no default `filePattern`, the manager is disabled.
For the manager to work, you must create a `managerFilePatterns` regular expression, or glob pattern.
For example:

```json
{
  "kubernetes": {
    "managerFilePatterns": ["/^config/.*\\.yaml$/"]
  }
}
```

#### Extending a manager's default managerFilePatterns

If the default `managerFilePatterns` for a manager does not match your file(s), you can _extend_ the pattern.
You extend the pattern by configuring the manager's `managerFilePatterns`.
For example:

```json
{
  "dockerfile": {
    "managerFilePatterns": ["does-not-look-like-a-docker-file"]
  }
}
```

#### Ignoring files that match the default managerFilePatterns

Renovate will _extend_ the existing [`managerFilePatterns`](../../configuration-options.md#managerfilepatterns), meaning you don't need to include the default patterns like `Dockerfile` in your own array.
In other words, the patterns are "additive".
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
