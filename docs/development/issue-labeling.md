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
    status:ready
    status:in-progress
    status:waiting-on-response

</details>

Use these to label the status of an issue.
For example, use `status:requirements` to mean that an issue is not yet ready for development to begin.
If we need the original poster or somebody else to respond to a query of ours, apply the `status:waiting-on-response` label.
All open issues should have some `status:*` label applied, and [this search](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+-label%3Astatus%3Arequirements+-label%3Astatus%3Aready+-label%3Astatus%3Ain-progress+-label%3Astatus%3Ablocked+-label%3Astatus%3Awaiting-on-response+) can find any which are missing a status label.

### Type of issue

<details>
    <summary>Type of issue</summary>

    type:bug
    type:docs
    type:feature
    type:refactor
    type:help

</details>

Use these to label the type of issue.
For example, use `type:bug` to label a bug type issue, and use `type:feature` for feature requests.
Only use `type:refactor` for code changes, don't use `type:refactor` for documentation type changes.
Use the `type:help` label for issues which should be converted to a discussion post.

Any issue which has the label `status:ready` should also have a `type:*` label, and [this search](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+-label%3Atype%3Abug+label%3Astatus%3Aready+-label%3Atype%3Afeature+-label%3Atype%3Adocs+-label%3Atype%3Arefactor+) can find any which are missing one.

Add the `breaking` label for Issues or PRs which have changes that are not backwards compatible and require a major version bump.

### Priority

<details>
    <summary>Priority</summary>

    priority-1-critical
    priority-2-high
    priority-3-medium
    priority-4-low
    priority-5-triage

</details>

Use these to assign a priority level to an issue.
Incoming issues are labeled `priority-5-triage` by default, this label should be replaced with a proper priority (low/normal/important/critical).
Try to select the proper priority.
Nothing bad will happen if you select a "wrong" priority.
At a high level: critical = needs immediate fix, important = to be prioritized ahead of others, normal = default priority, low = trivial issue, or impacts a very small % of the user base.

Use [this search](https://github.com/renovatebot/renovate/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+-label%3Apriority-1-critical+-label%3Apriority-2-high+-label%3Apriority-3-medium+-label%3Apriority-4-low++-label%3Apriority-5-triage) to find any issues which are missing a priority label.

### Impact

<details>
    <summary>Impact</summary>

    impact:small
    impact:medium
    impact:large

</details>

Use these to assign a impact level to an issue.
Impact means risk to the end users or their use cases.
It's used to identify which changes can be made relatively quickly versus those which require great care before merging, due to their chance of negatively impacting a wide number of users if there's a bug.
It does _not_ mean "amount of work for the maintainers".

### Platform

<details>
    <summary>Platform labels</summary>

    platform:azure
    platform:bitbucket
    platform:bitbucket-server
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
    core:changelogs
    core:config
    core:dashboard
    core:git
    core:onboarding
    core:schedule

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

    good first issue
    help wanted
    logs:problem
    reproduction:needed
    reproduction:provided
    duplicate

</details>

Add a label `good first issue` to issues that are small, easy to fix, and do-able for a newcomer.
This label is sometimes picked up by tools or websites that try to encourage people to contribute to open source.

Add the label `help wanted` to indicate that we need the original poster or someone else to do some work or it is unlikely to get done.

Add a label `logs:problem` to indicate that there's a problem with the logs, and the contributor needs to do one of these things:

1. Provide logs (if there are none yet)
1. Provide more logs (in case current logs are insufficient)
1. Format their logs properly

Add a label `reproduction:needed` if nobody's reproduced it in a public repo yet and such a reproduction is necessary before further work can be done.
Add the label `reproduction:provided` once there is a public reproduction.

Add a label `duplicate` to issues/PRs that are a duplicate of an earlier issue/PR.

### Self-hosted

<details>
    <summary>Self hosted</summary>

    self-hosted

</details>

Apply the `self-hosted` label when an issue is applicable only to users who self-administer their own bot.
