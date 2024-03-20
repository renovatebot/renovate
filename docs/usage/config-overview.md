# Renovate Configuration Overview

When Renovate runs on a repository, the final config in use is derived from:

- Global config
- Inherited config
- Repository config
- Resolved presets referenced in config

## Types of Config

### Global config

Global config is the term for config defined by the person or team responsible for running the bot.
Global config can contain config which is "global only" as well as any configuration options which are valid in Inherited config or Repository config.

If you are an end user of Renovate, such as a user of the Mend Renovate App, then you don't need to care too much about global config other than knowing that there are some settings you cannot change because they are global-only.
You can skip the rest of this "Global config" section and proceed to "Inherited config".

Global config can be read from file, environment, or CLI parameters.
You must configure at least one of these in order to provide your bot with the minimum details it needs to run, e.g. credentials.

#### File config

The first place Renovate global config is read from is from file.
By default Renovate checks for the existence of `config.js` in the current working directory, but you can override this by defining `RENOVATE_CONFIG_FILE` in env, e.g. `RENOVATE_CONFIG_FILE=/tmp/my-renovate-config.js`.

By default Renovate allows the config file to be _missing_ and does not error if it cannot find it, however if you have configured `RENOVATE_CONFIG_FILE` but the path you specified is not found then Renovate will error and exit, as it's assumed you have a configuration problem.
If the file is found but cannot be parsed then Renovate will also error and exit.

Global config files can be `.js` or `.json` files.
JS files can use synchronous or asyncronous methods inside, including even to fetch config information from remote hosts.

#### Environment config

Global config can be defined using environment variables.
For example, `RENOVATE_PLATFORM=gitlab` is the same as setting `"platform": "gitlab"` in File config.

Although the mapping from configuration option name to its corresponding Environment config name is fairly easy to understand, we recommend you consult the documentation for the field `env` for each option.
If the `env` field is missing then it means that the configuration option does not have its own Environment config variable name.

A special case for Environment config is the `RENOVATE_CONFIG` "meta" config option.
The `RENOVATE_CONFIG` option accepts a stringified full config, e.g. `RENOVATE_CONFIG={"platform":"gitlab","onboarding":false}`.
Any additional Environment config variables take precedence over values in `RENOVATE_CONFIG`.

<!-- prettier-ignore -->
!!! warning
    Escaping punctionation can be challenging to get right in some environments, especially if you're passing stringified values.

#### CLI config

The final way to configure Global config is through CLI parameters.
For example, the CLI parameter `--platform=gitlab` is the same as setting `"platform": "gitlab"` in File config or `RENOVATE_PLATFORM=gitlab` in Environment config.

CLI config is read last and takes precedence over Environment and File config, so if you configure conflicting values in more than one of these then the one in CLI config will "win".

### Inherited config

#### Use cases

The primary purpose of Inherited config is to allow for default settings of an organization/group.
There are two main use cases for Inherited config:

- Controlling onboarding settings within an org (e.g. disabling onboarding, making config optional)
- Defining default config settings for repos within an org

Although we generally recommend the use of shared presets for org config, default settings through Inherited config are useful if:

- You don't wish to have Repository config in each repo, or
- You onboarded many repos prior to having a shared org config, and don't want to retrospectively edit each repo's config

#### How it's found

If `inheritConfig` is `true` in Global config then Renovate will look for Inherited config before processing each repository.
The repository and file name which Renovate looks for can be configured using the other `inheritConfig*` settings documented in Global config.
Default values are `{{parentOrg}}/renovate-config` for repository name and `org-inherited-config.json` for file name.

If found, Inherited config will be merged on top (i.e. override) Global config, however note that there are many settings which are global-only so attempting to configure one of those will result in an error.

Inherited config can include all Repository config settings as well as any Global config options which are documented as "supportsInheritConfig".

For information on how the Mend Renovate App supports Inherited config, see the dedicated "Mend Renovate App Config" section toward the end of this page.

### Repository config

Repository config is the config loaded from the repository itself.
Alternative file names are supported, but the default is `renovate.json`.
If multiple such file names are found in the same repository then Renovate will use the first one it finds and ignore the other(s).

### Config precedence

Once Repository config is loaded, it is merged over the top of the previously loaded Global and Inherited config, meaning it takes precedence over them.
Presets referenced with an "extends" config are resolved first and take lower precedence over regular/raw config in the same file or config object.

## Onboarding

When Renovate processes a repository, one of the first decisions it makes is "Does this repository need to be onboarded?".
By default, Renovate will generate an "Onboarding PR" with a default config if a repository does not already have a Repository config file committed to the default branch.

### Onboarding Config

When Renovate creates an Onboarding PR it will propose a Repository config file to be merged.
By default, it is essentially an empty config with only the Renovate JSON schema referenced, but you can change this behavior if desired.

If you configure `onboardingConfig` in either Global config or Inherited config then Renovate will use that config directly instead of the default.

Alternatively if follow Renovate's naming convention for shared presets then it can automatically detect those instead.
If the repository `{{parentOrg}}/renovate-config` contains a `default.json` file then this will be treated as the organization's default preset and included in the Onboarding config.
Additionally for platforms which support nested Organization/Group hierarchies, Renovate will "hunt" up such hierarchies for a `renovate-config` repository with default config and stop when it finds the first.

<!-- prettier-ignore -->
!!! note
    Renovate will also check for `renovate.json` but this option is deprecated and is not recommended.

If a default config is not found in a `renovate-config` repository within the Organization, Renovate will also check for the presence of a `renovate-config.json` file within a `.{{platform}}` repository parallel to the current repository.
For example if the repository being onboarded is `abc/def` on a GitHub platform then Renovate will look for the existence of an `abc/.github` repository containing a `renovate-config.json` file.

### Changing Default Behavior

Default onboarding behavior for an Organization can be changed either in Global or Inherited config.

For example, if you set `onboarding=false` then it means Renovate won't onboard repositories and instead will skip them if no Repository config is found.
In other words, users would need to manually push a valid Repository config file in order for Renovate to be activated on the repository.

If you set `onboarding=false` plus also `requireConfig=optional` then it means Renovate will skip onboarding and proceed to run on a repository even if no Repository config is found.

## Shared Presets

### Overview

The concept of shared configuration concepts are covered in detail in a dedicated [Presets](./key-concepts/presets.md) page so please read that first for details.

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
- Being able to change settings across and entire Organization or groups of repositories in one place

Once you've created a centralized preset config, there are multiple ways you can pass it through to repositories:

- Defining it in Global config (either `globalExtends` or `extends`)
- Using it as your Inherited config, or referencing it from Inherited config using `extends`
- Ensuring it's referenced in Onboarding config so that it's committed as part of the Repository config

The above possibilities go from least to most transparent when it comes to end users.

Global config may be invisible to developers without log access, meaning they could be confused by any settings you apply - via presets or directly - withing Global config.
For example they wonder why Renovate is behaving differently to its documented default behavior and may even think it's a bug.

Inherited config is visible to developers (it's within a repository they can see) although it's _implicitly_ applied so without log access and if they're not aware to look for an Inherited config repository then they may again be a little confused as to why default behavior has changed.

Extending presets through Repository config is the most explicit and obvious way to use presets from an end user point of view.
If they wonder why behavior is a certain way, they can look at the Repository config and trace through all presets it references.

## Mend Renovate App Config

The [Mend Renovate App](https://github.com/apps/renovate) is a popular way to use Renovate on GitHub.com so it's important that any of its non-default behavior is documented here.

Importantly, logs for all Renovate jobs by the Mend Renovate App are available through the [Mend Developer Portal](https://developer.mend.io) so end users can view the logs to see which settings are applied.

### Onboarding behavior

If an Organization is installed with "All repositories" instead of "Selected repositories" then Renovate will default to "Silent" mode (`dryRun=lookup`).
This has been chosen for two reasons:

- Too often an account or org administrator selects this option without realizing it could cause the onboarding of hundreds of repositories, and
- By offering this option, it means that org administrators _can_ install into All repositories without worrying about the noise, and then let individual Repository admins decide if/when to start onboarding

If Renovate is installed, and you can see a job log, but Renovate is not onboarding your repository, look for `dryRun` in the logs to confirm you are in Silent mode and then change to Interactive mode either at the Repository level or Organization level.

Additionally, if an Organization is installed with "Selected repositories" then the app will change `onboardingNoDeps` to `true` so that an Onboarding PR is created even if no dependencies are detected.

### Fork Processing

If an Organization is installed with "All repositories" then `forkProcessing` will remain as the default value `false`.
i.e. Forked repositories are not onboarded and essentially ignored by Renovate.
To change this behavior you need to manually push a `renovate.json` to the repository with `"forkProcessing": true`.

If an Organization is instead installed with "Selected repositories" then it's assumed that the user wants all selected repositories onboarded so `forkProcessing` is set to `true`.

### Default presets

The Mend Renovate App adds the `mergeConfidence:all-badges` preset to `extends` automatically.
If you wish to disable Merge Confidence badges, add this preset to `ignorePresets`.

Additionally, the preset `config:recommended` is added to `onboardingConfig`.

### Allowed Post-upgrade commands

A limited set of approved `postUpgradeTasks` commands are allowed in the app.
They are not documented here as may change over time - please consult the logs to see them.
