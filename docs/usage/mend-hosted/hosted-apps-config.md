# Mend-hosted Apps Configuration

The Mend-hosted apps ([Renovate App on GitHub](https://github.com/apps/renovate) and [Mend App on Bitbucket](https://marketplace.atlassian.com/apps/1232072/mend)) are popular ways to use Renovate on the cloud. This section covers non-default behavior of these Mend-hosted apps.

Logs for all Renovate jobs by the Mend-hosted apps are available through the [Mend Developer Portal](https://developer.mend.io). Users can view the logs to see which settings are applied.

<!-- prettier-ignore -->
!!! note
    For general configuration of the Renovate CLI, refer to the documentation in the main [Configuration/Overview](../config-overview.md) section.

## Onboarding behavior

### Installing Renovate into all repositories leads to silent mode

If an Organization installed Renovate with "All repositories" (instead of "Selected repositories"), then Renovate will default to "Silent" mode (`dryRun=lookup`).
We chose this behavior because:

- Too often an account or org administrator selects the "All repositories" option and accidentally onboards hundreds of repositories, and
- By offering this option, it means that org administrators _can_ install Renovate into "All repositories" without worrying about the noise, and let individual repository admins decide if/when to start onboarding

#### Why we call this silent mode

- It's not just no PRs, it's also no Issues
- It's a common term across other Mend capabilities, such as OSS security and SAST security, where status checks also use silent/non-silent

### Get onboarding PRs from Renovate by getting out of silent mode

If Renovate is installed, _and_ you can see a job log, but Renovate is _not_ onboarding your repository: look for `dryRun` in the logs to confirm you are in Silent mode.
To get a onboarding PR from Renovate, change to Interactive mode either at the Repository level or Organization level.

### Installing Renovate into selected repositories always leads to onboarding PRs

Additionally, if an Organization is installed with "Selected repositories" then the app will change `onboardingNoDeps` to `"enabled"` so that an Onboarding PR is created even if no dependencies are detected.

## Fork Processing

If an Organization install Renovate with the "All repositories" option, then `forkProcessing` will remain as the default value `false`.
This means forked repositories are _not_ onboarded, Renovate essentially ignores them.
To change this behavior you need to manually push a `renovate.json` to the repository with `"forkProcessing": true`.

If an Organization installs Renovate with "Selected repositories" then we assume the organization wants all of the selected repositories onboarded (even forked repositories), so `forkProcessing` is set to `true`.

## Inherited config

The Mend Renovate app will automatically apply inherited config to all installed repositories in an organization when the following conditions are met:

1. A repository called `renovate-config` exists in the same organization and has the Mend Renovate app installed. (Onboarding not necessary)
2. The file `org-inherited-config.json` is detected in the `renovate-config` repository.

Unlike with the Self-hosted application, the values of the `inheritConfigFileName` and the `inheritConfigRepoName` cannot be changed in the Mend Renovate app.

To avoid wasted API calls to check for the existence of inherited config file, `inheritConfig` will be applied to all relevant repositories when a commit is made to add or modify the `inheritConfig` file.
It is important to note that the `inheritConfig` file will not be detected if the Mend Renovate app is not installed on the `renovate-config` repository at the time of adding or changing the file.

## Default presets

The Mend Renovate app automatically adds the `mergeConfidence:all-badges` preset to the `extends` array.
If you don't want the Merge Confidence badges, then add the `mergeConfidence:all-badges` preset to the `ignorePresets` array.

Additionally, the preset `config:recommended` is added to `onboardingConfig`.

## Allowed Post-upgrade commands

A limited set of approved `postUpgradeTasks` commands are allowed in the app.
They are not documented here as they may change over time - please consult the logs to see them.
