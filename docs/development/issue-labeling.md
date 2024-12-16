# Issue labeling

We try to keep issues well-classified through use of labels.
Any repository collaborator can apply labels according to the below guidelines.

The general idea is that we have:

- manager (`manager:`)
- versioning (`versioning:`)
- datasource (`datasource:`)
- platform (`platform:`)
- core functionality (`core:`)

The majority of issues should have at least one of those labels.
These labels should also map approximately to our Conventional Commit scopes.

## Basic knowledge about Renovate

You should know about platforms, package managers, datasources and versioning to label issues effectively.

- To learn about platforms, read the [Renovate docs on Platforms](https://docs.renovatebot.com/modules/platform/)
- To learn about managers, read the [Renovate docs on Managers](https://docs.renovatebot.com/modules/manager/)
- To learn about datasources, read the [Renovate docs on Datasources](https://docs.renovatebot.com/modules/datasource/)
- To learn more about versioning, read the [Renovate docs on Versioning](https://docs.renovatebot.com/modules/versioning/)

Most issues should have a label relating to either a platform, manager, datasource, versioning or worker topic.

## Label categories

### Status

<details>
    <summary>Status of issue</summary>

    status:requirements
    status:blocked
    status:in-progress

</details>

Use these to label the status of an issue.
For example, use `status:requirements` to mean that an issue is not yet ready for development to begin.

### Type of issue

<details>
    <summary>Type of issue</summary>

    type:bug
    type:docs
    type:feature
    type:refactor

</details>

Use these to label the type of issue.
For example, use `type:bug` to label a bug type issue, and use `type:feature` for feature requests.
Only use `type:refactor` for code changes, don't use `type:refactor` for documentation type changes.

All issues should have a `type:*` label.
Use [this search](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+-label%3Atype%3Abug+-label%3Atype%3Afeature+-label%3Atype%3Adocs+-label%3Atype%3Arefactor+) to find issues without a `type:*` label.

Add the `breaking` label for Issues or PRs which have changes that are not backwards compatible and require a major version bump.

### Priority

<details>
    <summary>Priority</summary>

    priority-1-critical
    priority-2-high
    priority-3-medium
    priority-4-low

</details>

Use these to assign a priority level to an issue.
Try to select the proper priority.
Nothing bad will happen if you select a "wrong" priority.
At a high level: critical = needs immediate fix, high = to be prioritized ahead of others, medium = default priority, low = trivial issue, or impacts a very small percentage of the user base.

Use [this search](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+-label%3Apriority-1-critical+-label%3Apriority-2-high+-label%3Apriority-3-medium+-label%3Apriority-4-low) to find any issues which are missing a priority label.

### Platform

<details>
    <summary>Platform labels</summary>

    platform:azure
    platform:bitbucket
    platform:bitbucket-server
    platform:codecommit
    platform:gitea
    platform:github
    platform:gitlab

</details>

Use these to mark the platform that is affected by this issue.
Keep in mind that an issue can be both affecting a platform and a self-hosted instance.

### Core

<details>
    <summary>Core labels</summary>

    core:automerge
    core:autoreplace
    core:cache
    core:changelogs
    core:config
    core:dashboard
    core:git
    core:onboarding
    core:package-rules
    core:schedule
    core:vulnerabilities

</details>

The purpose of these labels is to allow browsing of open issues by the most commonly-used functionality, such as automerging or Dependency Dashboard.

### Manager

"manager" is short for "package manager".
Add the relevant `manager:` labels to the issue.
If there are multiple managers affected, add labels for all of them.

### Datasource

Use a `datasource:` label when it is applicable specifically to particular datasources (for example, as defined in the docs list of datasources).

### Worker

<details>
    <summary>Worker</summary>

    worker:branch
    worker:global
    worker:pr
    worker:repository

</details>

A worker is the "core" logic of Renovate.
Use these labels to differentiate between the different internal Renovate working stages.

### New stuff

<details>
    <summary>New stuff</summary>

    new datasource
    new package manager
    new platform
    new versioning

</details>

Apply these labels when somebody opens a `feature` type issue requesting a new datasource, package manager, platform, or new versioning scheme.

### Housekeeping

<details>
    <summary>Housekeeping</summary>

    duplicate
    good first issue
    help wanted
    auto:bad-vibes
    auto:discussion-closed
    auto:discussion-first
    auto:format-code
    auto:logs
    auto:needs-details
    auto:no-coverage-ignore
    auto:no-done-comments
    auto:reproduction
    auto:retry-latest

</details>

Add a label `duplicate` to issues/PRs that are a duplicate of an earlier issue/PR.

Add a label `good first issue` to issues that are small, easy to fix, and do-able for a newcomer.
This label is sometimes picked up by tools or websites that try to encourage people to contribute to open source.

Add the label `help wanted` to indicate that we need the original poster or someone else to do some work or it is unlikely to get done.

Add a label `auto:bad-vibes` to any discussion containing rude comments such as excessive criticism or ungratefulness.

Add a label `auto:discussion-closed` to close a discussion which had persistent or very bad vibes.

Add a label `auto:discussion-first` to any PR which needs discussing first.

Add a label `auto:format-code` to any Discussion which needs code formatting.

Add a label `auto:logs` to indicate that there's a problem with the logs, and the contributor needs to do one of these things:

1. Provide logs (if there are none yet)
1. Provide more logs (in case current logs are insufficient)
1. Format their logs properly

Add a label `auto:needs-details` to discussions which need more details to move forward.

Add a label `auto:no-coverage-ignore` if PR authors avoid needed unit tests by istanbul ignoring code with the `// istanbul ignore` comment.

Add a label `auto:no-done-comments` if PR authors unnecessary "Done" comments, or type comments to ask for a review instead of requesting a new review through GitHub's UI.

Add a label `auto:reproduction` if nobody's reproduced it in a public repo yet and such a reproduction is necessary before further work can be done.

Add a label `auto:retry-latest` to any Discussion where the user should retry the latest version of Renovate to see if the problem persists.

### Self-hosted

<details>
    <summary>Self hosted</summary>

    self-hosted

</details>

Apply the `self-hosted` label when an issue is applicable only to users who self-administer their own bot.

## Automated check for Issues with missing labels

We have a GitHub Action (`find-issues-with-missing-labels.yml`) to find issues on our repository that are missing labels.
Any Issues with missing labels will be put in a list in a new "error" Issue.

The Action runs each week.

### Apply the correct labels manually

The Action will _not_ fix any badly labeled issues.
This means that you, or we, must apply the correct labels to any affected Issue.
