<!--
This is the description users will see in https://github.com/apps/renovate.
It is **NOT** for https://github.com/marketplace/renovate

It is tracked here, so we can catch config migration issues, and generally improve it more centrally, but it requires a Mend employee to update it.
Changes will **NOT** be synced automagically.
-->

## Automated Dependency Updates

[Mend Renovate](https://www.mend.io/renovate/) keeps source code dependencies up-to-date using automated Pull Requests. It will scan repositories for package manager files (e.g. from npm/Yarn, Bundler, Composer, Go Modules, Pip/Pipenv/Poetry, Maven/Gradle, Dockerfile/k8s, and many more), and submit Pull Requests with updated versions whenever they are found.

This app is free to install for both public and private repositories. Service is provided complimentary of Mend (formerly known as WhiteSource) and no paid plan is required.

### Intelligent, helpful onboarding

![Onboarding](https://docs.renovatebot.com/assets/images/onboarding.png)

Install Mend Renovate risk-free and you'll first receive an onboarding Pull Request in each repository. It analyzes the repository files and describes what will happen next, so there's no surprises.

### Unopinionated, highly flexible configuration

```json
{
  "rangeStrategy": "pin",
  "ignorePaths": ["examples/**"],
  "packageRules": [{
    "packagePatterns": ["^angular.*"],
    "groupName": "angular",
    "automerge": true
  }]
}
```

Modify any of Renovate's smart defaults with custom overrides at the repository, package file, dependency type, and package levels.

### Support for monorepo directory structures

Renovate will scan all files in each repository to look for relevant package files. It will also group upgrades from the same monorepo into a single PR to ensure tests pass and PR noise is reduced. Natively supports Lerna and Yarn Workspaces with zero configuration necessary.

It is also works fine with a mix of package managers / languages within the same repository.

### Automatic lock file and checksum support

Renovate will generate updated lock files such as `package-lock.json` or `yarn.lock` if you're already using them. It will also automatically resolve any conflicts after merges.

### Ease the noise with custom schedules

```json
{
  "timezone": "America/New_York",
  "schedule": "before 5am every weekday",
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": "after 10pm on sunday"
  },
  "packageRules": [{
    "packageNames": ["aws-sdk"],
    "schedule": "before 5am every wednesday"
  }]
}
```

Throttle updates however you want with schedules, configurable right down to the per-package level.

### Rules-based automerging

![automerging](https://docs.renovatebot.com/assets/images/automerged-pr.png)

Merge some updates without human intervention if they pass tests and satisfy your automerge rules.
