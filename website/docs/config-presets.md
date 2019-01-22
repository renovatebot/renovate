---
title: Shareable Config Presets
description: Renovate's support for eslint-like shareable configs
---

# Shareable Config Presets

Renovate supports an `eslint`-like approach to shareable configs, which we usually refer to as "presets". These are added/configured via the `"extends"` field in any configuration object.

## Goals of Preset Configs

The main reason for supporting preset configs is to decrease duplication:

1.  You shouldn't need copy/paste config across all your repositories
2.  You shouldn't need to reinvent any config "wheels" that others have invented before

A further reason was to make Renovate configuration "self-documenting", by adding the `"description"` field to all preset configs.

## Implementation Approach

In order to achieve the above goals, preset configs have been implemented to allow a very modular approach - preset configs may be as small as a partial package rule or as extensive as an entire configuration, like an `eslint` config.

## Example configs

An example of a small rule is [":preserveSemverRanges"](https://github.com/singapore/renovate-config/blob/ad65548cd1612ce1d93b2139df7d0f53b3350c3a/packages/renovate-config-default/package.json#L32-L35), which has the description "Preserve (but continue to upgrade) any existing semver ranges". It simply sets the configuration option `rangeStrategy` to `replace`.

An example of a full config is ["config:base"](https://github.com/singapore/renovate-config/blob/master/packages/renovate-config-config/package.json#L16-L32), which is Renovate's default configuration. It mostly uses Renovate config defaults but adds a few smart customisations such as grouping monorepo packages together.

Special note: the `:xyz` naming convention (with `:` prefix) is a special shorthand for the [default](https://github.com/singapore/renovate-config/tree/master/packages/renovate-config-default) presets. i.e. `:xyz` is equivalent to `default:xyz`.

## How to Use Preset Configs

By default, the Renovate onboarding process will suggest `["config:base]"`. A typical onboarding `renovate.json` will therefore look like this:

```json
{
  "extends": ["config:base"]
}
```

Let's say you wish to modify that default behaviour, such as to schedule Renovate to process upgrades only during non-office hours. In that case you could modify the default `renovate.json` to be like this:

```json
{
  "extends": ["config:base", "schedule:nonOfficeHours"]
}
```

This makes use of the [schedules](https://github.com/singapore/renovate-config/blob/master/packages/renovate-config-schedule/package.json) presets. To see all presets published by the Renovate team then browse [https://github.com/singapore/renovate-config/tree/master/packages](https://github.com/singapore/renovate-config/tree/master/packages)

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

In short, the number of `{{argx}}` params in the definition is how many parameters you need to provide. Parameters must be strings, non-quoted, and separated by commas if there are more than one.

If you find that you are repeating config a lot, you might consider publishing one of these types of parameterised presets yourself, or if you think your preset would be valuable for others, please contribute a PR to the `renovatebot/presets` repository.

## How to Publish Preset Configs

If you manage multiple repositories (e.g. you're a GitHub org or an active private developer) and want the same custom config across all or most of them, then you might want to consider publishing your own preset config so that you can "extend" it in every applicable repository. That way when you want to change your Renovate configuration you can make the change in one location rather than having to copy/paste it to every repository individually.

Let's say that your username on npm and elsewhere is "fastcore". In that case, you can choose between publishing your preset config package as `@fastcore/renovate-config` or `renovate-config-fastcore`. Let's assume you choose `renovate-config-fastcore` as the package name:

You then need to publish the `renovate-config-fastcore` package where the `package.json` contains the field `renovate-config` and then put your config under the field `default`. For example:

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

It is also possible to host your preset config using just a regular GitHub repository and without needing to publish it to npmjs. In such cases Renovate will simply look for a renovate.json file in the default branch, e.g. master.

To host your preset config on GitHub:

- Create a new repository. Normally you'd call it renovate-config but it can be named anything
- Add a renovate.json to this new repo containing the preset config. No other files are necessary.
- In other repos, reference it in an extends array like "github>owner/name", e.g. "github>rarkins/renovate-config"

From then on Renovate will use the renovate config from the preset repo's default branch. You do not need to add it as a devDependency or add any other files to the preset repo.

Note: Unlike npmjs-hosted presets, GitHub-hosted ones can contain only one config.

## GitLab-hosted Presets

It is also possible to host your preset config using just a regular GitLab repository and without needing to publish it to npmjs. In such cases Renovate will simply look for a renovate.json file in the default branch, (for now only the master branch is supported).

To host your preset config on GitLab:

- Create a new repository on GitLab. Normally you'd call it renovate-config but it can be named anything
- Add a renovate.json to this new repo containing the preset config. No other files are necessary.
- In other repos, reference it in an extends array like "gitlab>owner/name", e.g. "gitlab>rarkins/renovate-config"

## Presets and Private Modules

Using your own preset config along with private npm modules can present a chicken and egg problem. You want to configure the encrypted token just once, which means in the preset. But you also probably want the preset to be private too, so how can the other repos reference it?

The answer is to host your preset using GitHub not npmjs, and make sure you have added the preset's repo to Renovate too. GitHub will then permit Renovate to access the preset repo whenever it is processing any other repos within the same account/org.

## Contributing to presets

Have you configured a rule that you think others might benefit from? Please consider contributing it to the [presets](https://github.com/renovatebot/presets) repository so that it gains higher visibility and saves others from reinventing the same thing.
