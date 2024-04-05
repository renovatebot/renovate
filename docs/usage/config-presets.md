---
title: Shareable Config Presets
description: Renovate's support for ESLint-like shareable configs
---

# Shareable Config Presets

This page describes how to configure your shared presets.
Read the [Key concepts, presets](./key-concepts/presets.md) page to learn more about presets in general.

Shareable config presets must use the JSON or JSON5 formats, other formats are not supported.

<!-- prettier-ignore -->
!!! warning
    Only use `default.json` for your presets.

<!-- prettier-ignore -->
!!! warning
    We've deprecated using a `renovate.json` file for presets, as this causes issues if the repository configuration _also_ uses a `renovate.json` file.
    If you're using a `renovate.json` file to share your presets, rename it to `default.json`.

<!-- prettier-ignore -->
!!! tip
    Describe what your preset does in the `"description"` field.
    This way your configuration is self-documenting.

## Extending from a preset

To use a preset put it in an `extends` array within your Renovate config.
Presets can be nested.

## Preset Hosting

Presets should be hosted in repositories, which usually means the same platform host as Renovate is running against.

Alternatively, Renovate can fetch preset files from an HTTP server.

<!-- prettier-ignore -->
!!! warning
    We deprecated npm-based presets.
    We plan to drop the npm-based presets feature in a future major release of Renovate.

You can set a Git tag (like a SemVer) to use a specific release of your shared config.

### GitHub

| name                                        | example use                      | preset    | resolves as                  | filename        | Git tag        |
| ------------------------------------------- | -------------------------------- | --------- | ---------------------------- | --------------- | -------------- |
| GitHub default                              | `github>abc/foo`                 | `default` | `https://github.com/abc/foo` | `default.json`  | Default branch |
| GitHub with preset name                     | `github>abc/foo:xyz`             | `xyz`     | `https://github.com/abc/foo` | `xyz.json`      | Default branch |
| GitHub with preset name (JSON5)             | `github>abc/foo:xyz.json5`       | `xyz`     | `https://github.com/abc/foo` | `xyz.json5`     | Default branch |
| GitHub with preset name and path            | `github>abc/foo//path/xyz`       | `xyz`     | `https://github.com/abc/foo` | `path/xyz.json` | Default branch |
| GitHub default with a tag                   | `github>abc/foo#1.2.3`           | `default` | `https://github.com/abc/foo` | `default.json`  | `1.2.3`        |
| GitHub with preset name with a tag          | `github>abc/foo:xyz#1.2.3`       | `xyz`     | `https://github.com/abc/foo` | `xyz.json`      | `1.2.3`        |
| GitHub with preset name and path with a tag | `github>abc/foo//path/xyz#1.2.3` | `xyz`     | `https://github.com/abc/foo` | `path/xyz.json` | `1.2.3`        |
| GitHub with subpreset name and tag          | `github>abc/foo:xyz/sub#1.2.3`   | `sub`     | `https://github.com/abc/foo` | `xyz.json`      | `1.2.3`        |

### GitLab

| name                                        | example use                      | preset    | resolves as                  | filename        | Git tag        |
| ------------------------------------------- | -------------------------------- | --------- | ---------------------------- | --------------- | -------------- |
| GitLab default                              | `gitlab>abc/foo`                 | `default` | `https://gitlab.com/abc/foo` | `default.json`  | Default branch |
| GitLab with preset name                     | `gitlab>abc/foo:xyz`             | `xyz`     | `https://gitlab.com/abc/foo` | `xyz.json`      | Default branch |
| GitLab with preset name (JSON5)             | `gitlab>abc/foo:xyz.json5`       | `xyz`     | `https://gitlab.com/abc/foo` | `xyz.json5`     | Default branch |
| GitLab default with a tag                   | `gitlab>abc/foo#1.2.3`           | `default` | `https://gitlab.com/abc/foo` | `default.json`  | `1.2.3`        |
| GitLab with preset name with a tag          | `gitlab>abc/foo:xyz#1.2.3`       | `xyz`     | `https://gitlab.com/abc/foo` | `xyz.json`      | `1.2.3`        |
| GitLab with preset name and path with a tag | `gitlab>abc/foo//path/xyz#1.2.3` | `xyz`     | `https://gitlab.com/abc/foo` | `path/xyz.json` | `1.2.3`        |
| GitLab with subpreset name and tag          | `gitlab>abc/foo:xyz/sub#1.2.3`   | `sub`     | `https://gitlab.com/abc/foo` | `xyz.json`      | `1.2.3`        |

### Gitea

| name                                       | example use                     | preset    | resolves as                 | filename        | Git tag        |
| ------------------------------------------ | ------------------------------- | --------- | --------------------------- | --------------- | -------------- |
| Gitea default                              | `gitea>abc/foo`                 | `default` | `https://gitea.com/abc/foo` | `default.json`  | Default branch |
| Gitea with preset name                     | `gitea>abc/foo:xyz`             | `xyz`     | `https://gitea.com/abc/foo` | `xyz.json`      | Default branch |
| Gitea with preset name (JSON5)             | `gitea>abc/foo:xyz.json5`       | `xyz`     | `https://gitea.com/abc/foo` | `xyz.json5`     | Default branch |
| Gitea default with a tag                   | `gitea>abc/foo#1.2.3`           | `default` | `https://gitea.com/abc/foo` | `default.json`  | `1.2.3`        |
| Gitea with preset name with a tag          | `gitea>abc/foo:xyz#1.2.3`       | `xyz`     | `https://gitea.com/abc/foo` | `xyz.json`      | `1.2.3`        |
| Gitea with preset name and path with a tag | `gitea>abc/foo//path/xyz#1.2.3` | `xyz`     | `https://gitea.com/abc/foo` | `path/xyz.json` | `1.2.3`        |
| Gitea with subpreset name and tag          | `gitea>abc/foo:xyz/sub#1.2.3`   | `sub`     | `https://gitea.com/abc/foo` | `xyz.json`      | `1.2.3`        |

### Self-hosted Git

| name                                       | example use                     | preset    | resolves as                          | filename        | Git tag        |
| ------------------------------------------ | ------------------------------- | --------- | ------------------------------------ | --------------- | -------------- |
| Local default                              | `local>abc/foo`                 | `default` | `https://github.company.com/abc/foo` | `default.json`  | Default branch |
| Local with preset path                     | `local>abc/foo:xyz`             | `xyz`     | `https://github.company.com/abc/foo` | `xyz.json`      | Default branch |
| Local with preset path (JSON5)             | `local>abc/foo:xyz.json5`       | `xyz`     | `https://github.company.com/abc/foo` | `xyz.json5`     | Default branch |
| Local with preset name and path            | `local>abc/foo//path/xyz`       | `xyz`     | `https://github.company.com/abc/foo` | `path/xyz.json` | Default branch |
| Local default with a tag                   | `local>abc/foo#1.2.3`           | `default` | `https://github.company.com/abc/foo` | `default.json`  | `1.2.3`        |
| Local with preset name with a tag          | `local>abc/foo:xyz#1.2.3`       | `xyz`     | `https://github.company.com/abc/foo` | `xyz.json`      | `1.2.3`        |
| Local with preset name and path with a tag | `local>abc/foo//path/xyz#1.2.3` | `xyz`     | `https://github.company.com/abc/foo` | `path/xyz.json` | `1.2.3`        |
| Local with subpreset name and tag          | `local>abc/foo:xyz/sub#1.2.3`   | `sub`     | `https://github.company.com/abc/foo` | `xyz.json`      | `1.2.3`        |

<!-- prettier-ignore -->
!!! tip
    You can't combine the path and sub-preset syntaxes.
    This means that anything in the form `provider>owner/repo//path/to/file:subsubpreset` is not supported.
    One workaround is to use distinct files instead of sub-presets.

## Example configs

An example of a small rule is `:preserveSemverRanges`, which has the description "Preserve (but continue to upgrade) any existing SemVer ranges.".
It simply sets the configuration option `rangeStrategy` to `replace`.

An example of a full config is `config:recommended`, which is Renovate's default configuration.
It mostly uses Renovate config defaults but adds a few smart customizations such as grouping monorepo packages together.

<!-- prettier-ignore -->
!!! note
    The `:xyz` naming convention (with `:` prefix) is shorthand for the `default:` presets.
    For example: `:xyz` is the same as `default:xyz`.

## How to Use Preset Configs

By default, Renovate App's onboarding PR suggests the `["config:recommended]"` preset.
If you're self hosting, and want to use the `config:recommended` preset, then you must add `"onboardingConfig": { "extends": ["config:recommended"] }` to your bot's config.

Read the [Full Config Presets](./presets-config.md) page to learn more about our `config:` presets.

A typical onboarding `renovate.json` looks like this:

```json
{
  "extends": ["config:recommended"]
}
```

Here's an example of using presets to change Renovate's behavior.
You're happy with the `config:recommended` preset, but want Renovate to create PRs when you're not at the office.
You look at our `schedule:` presets, and find the `schedule:nonOfficeHours` preset.
You put `schedule:nonOfficeHours` in the `extends` array of your `renovate.json` file, like this:

```json
{
  "extends": ["config:recommended", "schedule:nonOfficeHours"]
}
```

## Preset Parameters

If you browse the "default" presets, you will see some that have parameters, e.g.:

```json
{
  "labels": {
    "description": "Apply labels <code>{{arg0}}</code> and <code>{{arg1}}</code> to PRs",
    "labels": ["{{arg0}}", "{{arg1}}"]
  },
  "assignee": {
    "description": "Assign PRs to <code>{{arg0}}</code>",
    "assignees": ["{{arg0}}"]
  }
}
```

Here is how you would use these in your Renovate config:

```json
{
  "extends": [":labels(dependencies,devops)", ":assignee(rarkins)"]
}
```

In short, the number of `{{argx}}` parameters in the definition is how many parameters you need to provide.
Parameters must be strings, non-quoted, and separated by commas if there are more than one.

If you find that you are repeating config a lot, you might consider publishing one of these types of parameterized presets yourself.
Or if you think your preset would be valuable for others, please contribute a PR to the Renovate repository, see [Contributing to presets](#contributing-to-presets).

## GitHub-hosted Presets

To host your preset config on GitHub:

- Create a new repository. Normally you'd call it `renovate-config` but it can be named anything
- Add configuration files to this new repo for any presets you want to share. For the default preset, `default.json` will be checked. For named presets, `<preset-name>.json` will be loaded. For example, loading preset `library` would load `library.json`. No other files are necessary.
- In other repos, reference it in an extends array like "github>owner/name", for example:

  ```json
  {
    "extends": ["github>rarkins/renovate-config"]
  }
  ```

From then on Renovate will use the Renovate config from the preset repo's default branch.
You do not need to add it as a devDependency or add any other files to the preset repo.

## GitLab-hosted Presets

For a private GitLab repository Renovate requires at least `Reporter` level access.

To host your preset config on GitLab:

- Create a new repository on GitLab. Normally you'd call it `renovate-config` but it can be named anything
- Add a `default.json` to this new repo containing the preset config. No other files are necessary
- In other repos, reference it in an extends array like "gitlab>owner/name", e.g. "gitlab>rarkins/renovate-config"

## Gitea-hosted Presets

To host your preset config on Gitea:

- Create a new repository on Gitea. Normally you'd call it `renovate-config` but you can use any name you want
- Add a `default.json` to this new repository containing the preset config. No other files are necessary
- In other repositories, reference it in an extends array like `"gitea>owner/name"`, e.g. `"gitea>rarkins/renovate-config"`

## Local presets

Renovate also supports local presets, e.g. presets that are hosted on the same platform as the target repository.
This is especially helpful in self-hosted scenarios where public presets cannot be used.
Local presets are specified either by leaving out any prefix, e.g. `owner/name`, or explicitly by adding a `local>` prefix, e.g. `local>owner/name`.
Renovate will determine the current platform and look up the preset from there.

## Fetching presets from an HTTP server

If your desired platform is not yet supported, or if you want presets to work when you run Renovate with `--platform=local`, you can specify presets using HTTP URLs:

```json
{
  "extends": [
    "http://my.server/users/me/repos/renovate-presets/raw/default.json?at=refs%2Fheads%2Fmain"
  ]
}
```

Parameters are supported similar to other methods:

```json
{
  "extends": [
    "http://my.server/users/me/repos/renovate-presets/raw/default.json?at=refs%2Fheads%2Fmain(param)"
  ]
}
```

## Contributing to presets

Have you configured a rule that could help others?
Please consider contributing it to the [Renovate repository](https://github.com/renovatebot/renovate/tree/main/lib/config/presets/internal) so that it gains higher visibility and saves others from reinventing the same thing.

Create a [discussion](https://github.com/renovatebot/renovate/discussions) to propose your preset to the Renovate maintainers.
The maintainers can also help improve the preset, and let you know where to put it in the code.
If you are proposing a "monorepo" preset addition then it's OK to raise a PR directly as that can be more efficient than a GitHub Discussion.

## Group/Organization level presets

Whenever repository onboarding happens, Renovate checks for a a default config to extend.
Renovate will check for a repository called `renovate-config` with a `default.json` file in the parent user/group/org of the repository.
On platforms that support nested groups (e.g. GitLab), Renovate will check for this repository at each level of grouping, from nearest to furthest, and use the first one it finds.
On all platforms, it will then look for a repository named like `.{{platform}}` (e.g. `.github`) with a `renovate-config.json`, under the same top-level user/group/org.

If found, that repository's preset will be suggested as the sole extended preset, and any existing `onboardingConfig` config will be ignored/overridden.
For example the result may be:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["local>myorgname/.github:renovate-config"]
}
```

## npm-hosted presets

<!-- prettier-ignore -->
!!! warning
    Using npm-hosted presets is deprecated, we recommend you do not follow these instructions and instead use a `local` preset.

If you manage multiple repositories using Renovate and want the same custom config across all or most of them, then you might want to consider publishing your own preset config so that you can "extend" it in every applicable repository.
That way when you want to change your Renovate configuration you can make the change in one location rather than having to copy/paste it to every repository individually.

Let's say that your username on npm and elsewhere is "fastcore".
In that case, you can choose between publishing your preset config package as `@fastcore/renovate-config` or `renovate-config-fastcore`.
Let's assume you choose `renovate-config-fastcore` as the package name.

You then need to publish the `renovate-config-fastcore` package where the `package.json` has the field `renovate-config` and then put your config under the field `default`.
For example:

```json
{
  "name": "renovate-config-fastcore",
  "version": "0.0.1",
  "renovate-config": {
    "default": {
      "extends": ["config:recommended", "schedule:nonOfficeHours"]
    }
  }
}
```

Then in each of your repositories you can add your Renovate config like:

```json
{
  "extends": ["fastcore"]
}
```

Any repository including this config will then adopt the rules of the default `library` preset but schedule it on weeknights or weekends.

If you prefer to publish using the namespace `@fastcore/renovate-config` then you would use the `@` prefix instead:

```json
{
  "extends": ["@fastcore"]
}
```
