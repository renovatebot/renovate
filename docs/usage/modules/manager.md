# Managers

Renovate is based around the concept of "package managers", or "managers" for short.
These range from traditional package managers like npm, Bundler and Composer through to less traditional concepts like CircleCI or Travis config files.

The goal of Renovate is to detect and maintain all third party dependencies in your repositories, through the use of managers.

## Supported Managers

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->

## Configuring Managers

### File Matching

Most managers have a default `fileMatch` array.
`fileMatch` is an array of Regular Expression strings used to match against the repository file list.

#### Managers with no default fileMatch

Some managers have no default `fileMatch`, because they have no file naming convention that would let Renovate intelligently filter them.
In such a case, the manager will be effectively disabled until you configure a `fileMatch` value, e.g. like the following:

```json
{
  "kubernetes": {
    "fileMatch": ["^config/.*\\.yaml$"]
  }
}
```

#### Extending a manager's default fileMatch

If the default `fileMatch` value for a manager does not match against one of your relevant files, you can _extend_ the existing value(s) by configuring a manager's `fileMatch` like in this example:

```json
{
  "dockerfile": {
    "fileMatch": ["does-not-look-like-a-docker-file"]
  }
}
```

#### Ignoring files that match the default fileMatch

Note: Renovate will _extend_ the existing `fileMatch`, meaning you don't need to include the default values like `Dockerfile` in your own array.
In other words, the values are "additive". If a manager matches a file that you _don't_ want it to, ignore it using the `ignorePaths` configuration option.
Also, if you ever find that Renovate is _not_ matching a file name that you're certain it should, be sure to check that you your preset config isn't the cause of it.
The `config:base` preset ignores common test and example directory names, for example.

### Enabling and Disabling Managers

#### Enabling experimental managers

Most managers are enabled by default. For those that aren't - typically because they are considered experimental - you can opt-in to them like the following:

```json
{
  "experimental-manager": {
    "enabled": true
  }
}
```

#### Disabling managers

To disable a specific manager like `gradle`, do this:

```json
{
  "gradle": {
    "enabled": false
  }
}
```

To disable all managers within a language like `python`, do this:

```json
{
  "python": {
    "enabled": false
  }
}
```

Note: Only languages declared by a Renovate manager can be supported, so please verify first.

#### Limiting enabled managers

If you want to limit Renovate to only one or a small number of managers, you can do this with the `enabledManagers` array:

```json
{
  "enabledManagers": ["npm", "dockerfile"]
}
```

The above would then result in all other managers being disabled, including Bundler, Composer, Docker Compose, etc.
