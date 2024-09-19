## Mend Renovate App Configuration

The [Mend Renovate App](https://github.com/apps/renovate) is a popular way to use Renovate on GitHub.com so it's important that any of its non-default behavior is documented here.

Importantly, logs for all Renovate jobs by the Mend Renovate App are available through the [Mend Developer Portal](https://developer.mend.io) so end users can view the logs to see which settings are applied.

### Onboarding behavior

#### Installing Renovate into all repositories leads to silent mode

If an Organization installed Renovate with "All repositories" (instead of "Selected repositories"), then Renovate will default to "Silent" mode (`dryRun=lookup`).
We chose this behavior because:

- Too often an account or org administrator selects the "All repositories" option and accidentally onboards hundreds of repositories, and
- By offering this option, it means that org administrators _can_ install Renovate into "All repositories" without worrying about the noise, and let individual repository admins decide if/when to start onboarding

##### Why we call this silent mode

- It's not just no PRs, it's also no Issues
- It's a common term across other Mend capabilities, such as OSS security and SAST security, where status checks also use silent/non-silent

#### Get onboarding PRs from Renovate by getting out of silent mode

If Renovate is installed, _and_ you can see a job log, but Renovate is _not_ onboarding your repository: look for `dryRun` in the logs to confirm you are in Silent mode.
To get a onboarding PR from Renovate, change to Interactive mode either at the Repository level or Organization level.

#### Installing Renovate into selected repositories always leads to onboarding PRs

Additionally, if an Organization is installed with "Selected repositories" then the app will change `onboardingNoDeps` to `"enabled"` so that an Onboarding PR is created even if no dependencies are detected.

### Fork Processing

If an Organization install Renovate with the "All repositories" option, then `forkProcessing` will remain as the default value `false`.
This means forked repositories are _not_ onboarded, Renovate essentially ignores them.
To change this behavior you need to manually push a `renovate.json` to the repository with `"forkProcessing": true`.

If an Organization installs Renovate with "Selected repositories" then we assume the organization wants all of the selected repositories onboarded (even forked repositories), so `forkProcessing` is set to `true`.

### Inherited config

The Mend Renovate app will automatically apply inherited config to all installed repositories in an organization when the following conditions are met:

1. A repository called `renovate-config` exists in the same organization and has the Mend Renovate app installed. (Onboarding not necessary)
2. The file `org-inherited-config.json` is detected in the `renovate-config` repository.

Unlike with the Self-hosted application, the values of the `inheritConfigFileName` and the `inheritConfigRepoName` cannot be changed in the Mend Renovate app.

To avoid wasted API calls to check for the existence of inherited config file, `inheritConfig` will be applied to all relevant repositories when a commit is made to add or modify the `inheritConfig` file.
It is important to note that the `inheritConfig` file will not be detected if the Mend Renovate app is not installed on the `renovate-config` repository at the time of adding or changing the file.

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
