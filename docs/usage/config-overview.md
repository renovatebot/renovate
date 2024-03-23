# Renovate configuration overview

When Renovate runs on a repository, the final config used is derived from the:

- Default config
- Global config
- Inherited config
- Repository config
- Resolved presets referenced in config

## Types of config

### Default config

Every Renovate config option has a default value/setting.
That default value/setting may even be `null`.
You can find the default values on the Renovate docs website.

For example:

- The default value for `onboarding` is `true`
- The option `labels` lacks a default value, which means that no labels will be added to Renovate's PRs

The default config is loaded first, and may be superseded/overridden by the configuration types listed below.

### Global config

Global config means: the config defined by the person or team responsible for running the bot.
This is also referred to as "bot config", because it's the config passed to the bot by the person running it.
Global config can contain config which is "global only" as well as any configuration options which are valid in Inherited config or Repository config.

If you are an end user of Renovate, for example if you're using the Mend Renovate App, then you don't need to care as much about any global config.
As a end-user you can not change some settings because those settings are global-only.
If you are an end user, you can skip the rest of this "Global config" section and proceed to "Inherited config".

Global config can be read from a file, environment variable, or CLI parameters.
You must configure at least one of these for Renovate to have the information it needs to run.
For example: you may need to give Renovate the correct credentials.

#### File config

Renovate first tries to read the global config from a file.
By default Renovate checks for a `config.js` file in the current working directory.
But you can override this by defining `RENOVATE_CONFIG_FILE` in env, for example: `RENOVATE_CONFIG_FILE=/tmp/my-renovate-config.js`.

By default Renovate allows the config file to be _missing_ and does not error if it cannot find it.
But if you have configured `RENOVATE_CONFIG_FILE` and the path you specified is not found then Renovate will error and exit, because it assumes you have a configuration problem.
If the file is found but cannot be parsed then Renovate will also error and exit.

Global config files can be `.js` or `.json` files.
You may use synchronous or asynchronous methods inside a `.js` file, including even to fetch config information from remote hosts.

#### Environment config

Global config can be defined using environment variables.
The config options that you can use in environment variables all have the prefix `RENOVATE_`.
For example, `RENOVATE_PLATFORM=gitlab` is the same as setting `"platform": "gitlab"` in File config.

Usually there's a clear mapping from configuration option name to the corresponding Environment config name.
But we recommend you still check the documentation for the field `env` for each option to make sure.
If the configuration option lacks a `env` field, the config option also lacks a Environment config variable name.

A special case for Environment config is the `RENOVATE_CONFIG` "meta" config option.
The `RENOVATE_CONFIG` option accepts a stringified full config, for example: `RENOVATE_CONFIG={"platform":"gitlab","onboarding":false}`.
Any additional Environment config variables take precedence over values in `RENOVATE_CONFIG`.

##### Environment variable examples

<!-- prettier-ignore -->
!!! warning
    Make sure to escape any punctuation.
    Be extra careful if you're passing stringified values.

Boolean:

- `RENOVATE_ONBOARDING=true`

String:

- `RENOVATE_BASE_DIR=/tmp/something`
- `RENOVATE_BASE_DIR="/tmp/some thing"`

Number:

- `RENOVATE_PR_HOURLY_LIMIT=1`

List with numbers or strings:

- `RENOVATE_LABELS="abc,def,label with space"`

Objects, or lists with objects:

- `RENOVATE_CONFIG="{platform\":\"gitlab\",\"onboarding\":false}"`
- `RENOVATE_PACKAGE_RULES="[{matchHost:\"gitlab\",token:\"$SOME_TOKEN\"}]"`

<!-- prettier-ignore -->
!!! tip
    Use "stringify" ([Example online service](https://jsonformatter.org/json-stringify-online)) for strings and objects.

##### Experimental variables

Renovate has "experimental" environment variables, which start with `RENOVATE_X_`.
These variables are experimental, can be changed at any time, and are not parsed as part of regular configuration.
Read the [Self-hosted experimental environment variables](./self-hosted-experimental.md) docs to learn more.

##### Logging variables

Finally, there are some special environment variables that are loaded _before_ configuration parsing because they are used during logging initialization:

- `LOG_CONTEXT`: a unique identifier used in each log message to track context
- `LOG_FORMAT`: defaults to a "pretty" human-readable output, but can be changed to "json"
- `LOG_LEVEL`: most commonly used to change from the default `info` to `debug` logging

#### CLI config

The final way to configure Global config is through CLI parameters.
For example, the CLI parameter `--platform=gitlab` is the same as setting `"platform": "gitlab"` in File config or `RENOVATE_PLATFORM=gitlab` in Environment config.

CLI config is read last and takes precedence over Environment and File config.
For example, if you configure conflicting values in Environment, File config and CLI config, then the CLI config will be merged last and "win" if values conflict.

It is important that you:

- Always provide a value, even if the field is boolean (e.g. `--onboarding=true` and _not_ `--onboarding`), and
- Prefer `=` notation over spaces, e.g. `--onboarding=true` instead of `--onboarding true`

### Inherited config

#### Use cases

The primary purpose of Inherited config is to allow for default settings of an organization/group.
Two main use cases for Inherited config are:

- Controlling onboarding settings within an org (e.g. disabling onboarding, making config optional)
- Defining default config settings for repos within an org

We recommend that organizations use shared presets instead of Inherited config, if possible.
But default settings through Inherited config are useful if:

- You want to avoid setting Repository config in each repo, or
- You onboarded many repos prior to having a shared org config, and don't want to retrospectively edit each repo's config

#### How it's found

If `inheritConfig` is `true` in Global config then Renovate will look for Inherited config before processing each repository.
The repository and file name which Renovate looks for can be configured using the other `inheritConfig*` settings documented in Global config.
Default values are `{{parentOrg}}/renovate-config` for repository name and `org-inherited-config.json` for file name.

If found, Inherited config will be merged on top (i.e. override) Global config.
Avoid putting any global-only setting in a Inherited config, as doing so will result in an error.

Inherited config may use all Repository config settings, and any Global config options which have the "supportsInheritConfig" property in the docs.

For information on how the Mend Renovate App supports Inherited config, see the dedicated "Mend Renovate App Config" section toward the end of this page.

### Repository config

Repository config is the config loaded from a config file in the repository.
Alternative file names are supported, but the default is `renovate.json`.
If Renovate finds more than one configuration file in the same repository, then Renovate will use the _first_ configuration file it finds and ignores the other(s).

### Config precedence

Once Repository config is loaded, it is merged over the top of the previously loaded Global and Inherited config, meaning it takes precedence over them.
Presets referenced with an "extends" config are resolved first and take lower precedence over regular/raw config in the same file or config object.

## Onboarding

When Renovate processes a repository, one of the first decisions it makes is "Does this repository need to be onboarded?".
By default, Renovate will create an "Onboarding PR" with a default config if a repository does not have a Repository config file committed to the default branch.

### Onboarding Config

When Renovate creates an Onboarding PR it will propose a Repository config file to be merged.
By default, it is essentially an empty config with only the Renovate JSON schema referenced, but you can change this behavior if desired.

If you configure `onboardingConfig` in either Global config or Inherited config then Renovate will use that config directly instead of the default.

Alternatively if you follow Renovate's naming convention for shared presets then it can automatically detect those instead.
If the repository `{{parentOrg}}/renovate-config` has a `default.json` file then this will be treated as the organization's default preset and included in the Onboarding config.
Additionally for platforms which support nested Organization/Group hierarchies, Renovate will "hunt" up such hierarchies for a `renovate-config` repository with default config and stop when it finds the first.

<!-- prettier-ignore -->
!!! note
    Renovate will also check for a `renovate.json` file if it cannot find a `default.json` file in a preset, however this option is deprecated and not recommended.

If a default config is not found in a `renovate-config` repository within the Organization, Renovate will also check for the presence of a `renovate-config.json` file within a `.{{platform}}` repository parallel to the current repository.
For example if the repository being onboarded is `abc/def` on a GitHub platform then Renovate will look for the existence of an `abc/.github` repository containing a `renovate-config.json` file.

### Changing default behavior

Default onboarding behavior for an Organization can be changed either in Global or Inherited config.

For example, if you set `onboarding=false` then Renovate will not onboard repositories, and skip any repositories without a Repository config.
In other words, users need to manually push a valid Repository config file to activate Renovate on the repository.

If you set `onboarding=false` plus `requireConfig=optional` then it means Renovate will skip onboarding and proceed to run on a repository, even if Renovate does not find any Repository config.

## Shared Presets

### Overview

The concept of shared configuration is covered in detail on the [Presets](./key-concepts/presets.md) page, so please read that first.

### Use of Presets in Global config

Presets should be used cautiously in Global config as they often lead to misunderstandings.

#### globalExtends

Sometimes you may not wish to put all settings within the Global config itself and instead commit it to a repository which is then referenced from the Global config.
In such cases, use `globalExtends` instead of `extends` so that it is resolved immediately and used as part of Global config.

#### extends

If you use `extends` within Global config then it's important to note that these are _not_ resolved/expanded during Global config processing and instead are passed through unresolved to be part of Repository config.
Passing `extends` through to be part of Repository config has two major consequences:

- It allows repository users to be able to use `ignorePresets` to ignore all or part of the `extends` presets, and
- Presets defined within `extends` in Global config will take _higher_ precedence that "regular" Global config, because it's resolved later

### Using a centralized config

Using "centralized" configs through Renovate presets is important in order to be able to:

- Save time by not repeating yourself in every repo with the same config, and
- Being able to change settings across an entire Organization or groups of repositories in one place

Once you've created a centralized preset config, there are multiple ways you can pass it through to repositories:

- Defining it in Global config (either `globalExtends` or `extends`)
- Using it as your Inherited config, or referencing it from Inherited config using `extends`
- Ensuring it's referenced in Onboarding config so that it's committed as part of the Repository config

The above possibilities go from least to most transparent when it comes to end users.

Global config may be invisible to developers without log access, meaning they could be confused by any settings you apply - via presets or directly - within Global config.
For example the developers wonder why Renovate is behaving differently to its documented default behavior and may even think it's a bug.

Inherited config is visible to developers (it's within a repository they can see) although it's _implicitly_ applied so without log access and if they're not aware to look for an Inherited config repository then they may again be a little confused as to why default behavior has changed.

The recommended approach for using a centralized preset is to explicitly "extend" it from every repository, which can be achieved easily if it's part of your `onboardingConfig`.
By having your centralized preset part of each Repository config `extends`, it has these two benefits:

- You still have the ability to change shared settings in a single location
- Any user viewing the repo can see the preset being extended and trace it back to understand which config is applied

## Mend Renovate App Config

The [Mend Renovate App](https://github.com/apps/renovate) is a popular way to use Renovate on GitHub.com so it's important that any of its non-default behavior is documented here.

Importantly, logs for all Renovate jobs by the Mend Renovate App are available through the [Mend Developer Portal](https://developer.mend.io) so end users can view the logs to see which settings are applied.

### Onboarding behavior

If an Organization installed Renovate with "All repositories" (instead of "Selected repositories"), then Renovate will default to "Silent" mode (`dryRun=lookup`).
We chose this behavior because:

- Too often an account or org administrator selects the "All repositories" option and accidentally onboards hundreds of repositories, and
- By offering this option, it means that org administrators _can_ install Renovate into "All repositories" without worrying about the noise, and then let individual Repository admins decide if/when to start onboarding

If Renovate is installed, and you can see a job log, but Renovate is not onboarding your repository, look for `dryRun` in the logs to confirm you are in Silent mode and then change to Interactive mode either at the Repository level or Organization level.

Additionally, if an Organization is installed with "Selected repositories" then the app will change `onboardingNoDeps` to `true` so that an Onboarding PR is created even if no dependencies are detected.

### Fork Processing

If an Organization install Renovate with the "All repositories" option, then `forkProcessing` will remain as the default value `false`.
This means forked repositories are _not_ onboarded, Renovate essentially ignores them.
To change this behavior you need to manually push a `renovate.json` to the repository with `"forkProcessing": true`.

If an Organization installs Renovate with "Selected repositories" then we assume the organization wants all of the selected repositories onboarded (even forked repositories), so `forkProcessing` is set to `true`.

### Default presets

The Mend Renovate app automatically adds the `mergeConfidence:all-badges` preset to the `extends` array.
If you don't want the Merge Confidence badges, then add the `mergeConfidence:all-badges` preset to the `ignorePresets` array.

Additionally, the preset `config:recommended` is added to `onboardingConfig`.

### Allowed Post-upgrade commands

A limited set of approved `postUpgradeTasks` commands are allowed in the app.
They are not documented here as they may change over time - please consult the logs to see them.

## Other

The below contains edge cases which you should avoid if possible, and likely don't need to use.
They are included here because they can cause "exceptions" to some of the previously mentioned rules of config.

### Optimize for Disabled

The `optimizeForDisabled` option was designed for an edge case where a large percentage of repos are disabled by config.
If this option is set to `true`, Renovate will use a platform API call to see if a `renovate.json` exists and if it contains `"enabled": false`.
If so, the repository will be skipped without a clone necessary.
If the file is not present or does not disable Renovate, then Renovate continues as before (having "wasted" that extra API call).

### Force config

We recommend you avoid the `force` config option, if possible.

It can be used to "force" config over the top of other config or rules which might be merged later, so at times can cause confusion - especially if it's defined in Global config and overriding settings in Repository config.
