# Issue labeling

We try to keep issues well-classified through use of labels.
Any repository collaborator can apply labels according to the below guidelines.

## Basic knowledge about Renovate

You should know about platforms, package managers, datasources and versioning to label issues effectively.

- To learn about platforms, read the [Renovate docs on Platforms](https://docs.renovatebot.com/modules/platform/).
- To learn about managers, read the [Renovate docs on Managers](https://docs.renovatebot.com/modules/manager/).
- To learn about datasources, read the [Renovate docs on Datasources](https://docs.renovatebot.com/modules/datasource/).
- To learn more about versioning, read the [Renovate docs on Versioning](https://docs.renovatebot.com/modules/versioning/).

Most issues should have a label relating to either a platform, manager, datasource, versioning or worker topic.

## Label categories

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

Add the `breaking` label for Issues or PRs which contain changes that are not backwards compatible and require a major version bump.

### Priority

<details>
    <summary>Priority</summary>

    priority-1-critical
    priority-2-important
    priority-3-normal
    priority-4-low

</details>

Use these to assign a priority level to an issue.
Make a best-effort attempt to select a proper priority.
Nothing bad will happen if you select a "wrong" priority.
At a high level: critical = needs immediate fix, important = to be prioritized ahead of others, normal = default priority, low = trivial issue, or impacts a very small % of the user base.

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
Keep in mind that an issue can be both affecting a platform and a self hosted instance.

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
    worker:onboarding
    worker:pr

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
    reproduced
    reproduction needed

</details>

Add a label `good first issue` to issues that are small, easy to fix, and do-able for a newcomer.
This label is sometimes picked up by tools or websites that try to encourage people to contribute to open source.

Add the label `help wanted` to indicate that we need the original poster or someone else to do some work or it is unlikely to get done.

Add a label `reproduction needed` if nobody's reproduced it in a public repo yet and such a reproduction is necessary before further work can be done.
Add the label `reproduced` once there is a public reproduction.

### Self hosted

<details>
    <summary>Self hosted</summary>

    self-hosted

</details>

Use the `self-hosted` label to identify when an issue is applicable only to users who self-administer their own bot.
