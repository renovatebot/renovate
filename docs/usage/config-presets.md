---
title: Shareable Config Presets
description: Renovate's support for ESLint-like shareable configs
---

# Shareable Config Presets

Renovate's "config presets" are a convenient way to distribute config that is reused across multiple repositories.
It is similar in design to `eslint`'s shareable configs, and can be used both for whole repository configs as well as for individual rules.
They are defined using the `extends` array within config and may also be nested.

In short:

- Browse [Renovate's default presets](https://docs.renovatebot.com/presets-default/) to find any that are useful to you
- Publish your own if you wish to reuse them across repositories

## Goals of Preset Configs

The main reason for supporting preset configs is to decrease duplication:

1.  You shouldn't need copy/paste the same config across all your repositories
2.  You shouldn't need to reinvent any config "wheels" that others have invented before

A further reason was to make Renovate configuration "self-documenting", by adding the `"description"` field to all preset configs.

## Implementation Approach

In order to achieve the above goals, preset configs have been implemented to allow a very modular approach - preset configs may be as small as a partial package rule or as extensive as an entire configuration, like an `eslint` config.

## Preset Hosting

Presets can be defined using either npm packages, or with GitHub/GitLab repositories. Bitbucket-hosted presets are yet to be implemented.

The following namespace is used:

- `abc`: npm package `renovate-config-abc` and preset `default`
- `@abc`: npm package `@abc/renovate-config` and preset `default`
- `abc:xyz`: npm package `renovate-config-abc` and preset `xyz`
- `@abc:xyz`: npm package `@abc/renovate-config` and preset `xyz`
- `github>abc/foo`: github repository `https://github.com/abc/foo` and preset `default`
- `github>abc/foo:xyz`: github repository `https://github.com/abc/foo` and preset `xyz`
- `gitlab>abc/foo`: gitlab repository `https://gitlab.com/abc/foo` and preset `default`
- `gitlab>abc/foo:xyz`: gitlab repository `https://gitlab.com/abc/foo` and preset `xyz`

In general, GitHub or GitLab-based preset hosting is easier than npm because you avoid the "publish" step - simply commit preset code to the default branch and it will be picked up by Renovate the next time it runs.
An additional benefit of using source code hosting is that the same token/authentication can be reused by Renovate in case you want to make your config private.

## Example configs

An example of a small rule is `:preserveSemverRanges`, which has the description "Preserve (but continue to upgrade) any existing semver ranges".
It simply sets the configuration option `rangeStrategy` to `replace`.

An example of a full config is `config:base`, which is Renovate's default configuration.
It mostly uses Renovate config defaults but adds a few smart customisations such as grouping monorepo packages together.

Special note: the `:xyz` naming convention (with `:` prefix) is a special shorthand for the `default:` presets.
i.e. `:xyz` is equivalent to `default:xyz`.

## How to Use Preset Configs

By default, the Renovate App's onboarding process will suggest `["config:base]"`.
If you are self hosting then you must add `"onboardingConfig": { "extends": ["config:base"] }` to your bot's config.

A typical onboarding `renovate.json` will then look like this:

```json
{
  "extends": ["config:base"]
}
```

Let's say you wish to modify that default behaviour, such as to schedule Renovate to process upgrades only during non-office hours.
In that case you could modify the default `renovate.json` to be like this:

```json
{
  "extends": ["config:base", "schedule:nonOfficeHours"]
}
```

This makes use of the `schedules:` presets.
To see all presets published by the Renovate team then browse the "Config Presets" section of [Renovate Docs](https://docs.renovatebot.com).

## Preset Parameters

If you browse the "default" presets, you will see some that contain parameters, example:

```json
    "labels": {
      "description": "Apply labels <code>{{arg0}}</code> and <code>{{arg1}}</code> to PRs",
      "labels": [
        "{{arg0}}",
        "{{arg1}}"
      ]
    },
    "assignee": {
      "description": "Assign PRs to <code>{{arg0}}</code>",
      "assignees": [
        "{{arg0}}"
      ]
    },
```

Here is how you would use these in your Renovate config:

```json
  "extends": [
    ":labels(depedendencies,devops)",
    ":assignee(rarkins)"
  ]
```

In short, the number of `{{argx}}` params in the definition is how many parameters you need to provide.
Parameters must be strings, non-quoted, and separated by commas if there are more than one.

If you find that you are repeating config a lot, you might consider publishing one of these types of parameterised presets yourself, or if you think your preset would be valuable for others, please contribute a PR to the Renovate repository.

## How to Publish Preset Configs

If you manage multiple repositories using Renovate and want the same custom config across all or most of them, then you might want to consider publishing your own preset config so that you can "extend" it in every applicable repository.
That way when you want to change your Renovate configuration you can make the change in one location rather than having to copy/paste it to every repository individually.

Let's say that your username on npm and elsewhere is "fastcore".
In that case, you can choose between publishing your preset config package as `@fastcore/renovate-config` or `renovate-config-fastcore`.
Let's assume you choose `renovate-config-fastcore` as the package name:

You then need to publish the `renovate-config-fastcore` package where the `package.json` contains the field `renovate-config` and then put your config under the field `default`.
For example:

```json
{
  "name": "renovate-config-fastcore",
  "version": "0.0.1",
  ...
  "renovate-config": {
    "default": {
      "extends": ["config:base", "schedule:nonOfficeHours"]
    }
  }
}
```

Then in each of your repositories you can add your renovate config like:

```json
  "extends": ["fastcore"]
```

Any repository including this config will then adopt the rules of the default `library` preset but schedule it on weeknights or weekends.

Note: if you prefer to publish using the namespace `@fastcore/renovate-config` then you would use the `@` prefix instead:

```json
  "extends": ["@fastcore"]
```

## GitHub-hosted Presets

It is also possible to host your preset config using just a regular GitHub repository and without needing to publish it to npmjs.
In such cases Renovate will simply look for a renovate.json file in the default branch, e.g. master.

To host your preset config on GitHub:

- Create a new repository. Normally you'd call it renovate-config but it can be named anything
- Add configuration files to this new repo for any presets you want to share. For the default preset, `default.json` will be checked first and then `renovate.json`. For named presets, `<preset-name>.json` will be loaded. For example, loading preset `library` would load `library.json`. No other files are necessary.
- In other repos, reference it in an extends array like "github>owner/name", for example:

  ```json
    "extends": ["github>rarkins/renovate-config"]
  ```

From then on Renovate will use the renovate config from the preset repo's default branch.
You do not need to add it as a devDependency or add any other files to the preset repo.

## GitLab-hosted Presets

It is also possible to host your preset config using just a regular GitLab repository and without needing to publish it to npmjs.
In such cases Renovate will simply look for a renovate.json file in the default branch, (for now only the master branch is supported).

To host your preset config on GitLab:

- Create a new repository on GitLab. Normally you'd call it renovate-config but it can be named anything
- Add a renovate.json to this new repo containing the preset config. No other files are necessary.
- In other repos, reference it in an extends array like "gitlab>owner/name", e.g. "gitlab>rarkins/renovate-config"

## Local presets

Renovate also supports local presets, i.e. presets that are hosted on the same platform as the target repository.
This is especially helpful in self-hosted scenarios where public presets cannot be used.
Local presets are only supported on GitHub, GitLab and Bitbucket Server.
Local presets are specified either by leaving out any prefix, e.g. `owner/name`, or explicitly by adding a `local>` prefix, e.g. `local>owner/name`.
Renovate will determine the current platform and look up the preset from there.

## Presets and Private Modules

Using your own preset config along with private npm modules can present a chicken and egg problem.
You want to configure the encrypted token just once, which means in the preset.
But you also probably want the preset to be private too, so how can the other repos reference it?

The answer is to host your preset using GitHub or GitLab - not npmjs - and make sure you have added the preset's repo to Renovate too.
GitHub will then permit Renovate to access the preset repo whenever it is processing any other repos within the same account/org.

## Contributing to presets

Have you configured a rule that you think others might benefit from?
Please consider contributing it to the [Renovate](https://github.com/renovatebot/renovate) repository so that it gains higher visibility and saves others from reinventing the same thing.

## Organization level presets

Whenever repository onboarding happens, Renovate checks if the current user/group/org contains a default config to extend.
It looks for:

- A repository called `renovate-config` under the same user/group/org with either `default.json` or `renovate.json`, or
- A repository named like `.{{platform}}` (e.g. `.github`) under the same user/group/org with `renovate-config.json`

If found, that repository's preset will be suggested as the the sole extended preset, and any existing `onboardingConfig` config will be ignored/overridden.
For example the result may be:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["local>myorgname/.github:renovate-config"]
}
```
