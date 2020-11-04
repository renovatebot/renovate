# Issue labeling

We try to keep issues well-classified by labeling them appropriately.
Only members/collaborators with the required rights can apply labels.

In theory any feature or bug should apply to either a platform, manager, datasource, versioning or a worker part.

## Basic knowledge about Renovate

You should know about platforms, package managers, datasources and versioning to label issues effectively.

- To learn about platforms, read the [Renovate docs on Platforms](https://docs.renovatebot.com/modules/platform/).
- To learn about managers, read the [Renovate docs on Managers](https://docs.renovatebot.com/modules/manager/).
- To learn about datasources, read the [Renovate docs on Datasources](https://docs.renovatebot.com/modules/datasource/).
- To learn more about versioning, read the [Renovate docs on Versioning](https://docs.renovatebot.com/modules/versioning/).

## Label categories

### Priority

<details>
    <summary>Priority</summary>

    pri1-critical
    pri2-important
    pri3-normal
    pri4-low
    wontfix

</details>

Use these to assign a priority level to an issue.
Make a best-effort attempt to select a proper priority.
Nothing bad will happen if you select a "wrong" priority.

### Type of issue

<details>
    <summary>Type of issue</summary>

    bug
    docs
    feature
    refactor
    breaking

</details>

Use these to label the type of issue.
For example, use `bug` to label a bug type issue, and use `feature` for feature requests.
Only use `refactor` for code changes, don't use `refactor` for documentation type changes.

Use the `breaking` label for Issues or PRs which contain changes that are not backwards compatible and require a major release bump.

### Housekeeping

<details>
    <summary>Housekeeping</summary>

    good first issue
    help wanted
    needs reproduction
    reproduced

</details>

Add a label `good first issue` to issues that are small, easy to fix, and do-able for a newcomer.
This label is sometimes picked up by tools or websites that try to encourage people to contribute to open source.

Add a label `needs reproduction` if nobody's reproduced it in a public repo yet and such a reproduction is necessary before further work can be done.
Add the label `reproduced` once there is a public reproduction.

Add the label `help wanted` to indicate that we need the original poster or someone else do some work or it is unlikely to get done.

### Miscellaneous

<details>
    <summary>Miscellaneous</summary>

    self hosted

</details>

Use the `self hosted` label to identify when an issue is applicable only to users who self-administer their own bot.

### Datasource

<details>
    <summary>Datasource</summary>

    datasource:docker
    datasource:git-submodule
    datasource:git-labels
    datasource:jenkins
    datasource:maven
    datasource:nuget
    datasource:packagist
    datasource:pypi
    datasource:rubygems
    datasource:terraform-module
    datasource:terraform-provider

</details>

Use a `datasource:` label when it is applicable specifically to particular datasources (for example, as defined in the docs list of datasources).

### Manager

<details>
    <summary>Manager</summary>

    manager:bazel
    manager:buildkite
    manager:bundler
    manager:cargo
    manager:circleci
    manager:cocoapods
    manager:composer
    manager:docker-compose
    manager:dockerfile
    manager:github-actions
    manager:gitlab-ci
    manager:gomod
    manager:gradle
    manager:helm
    manager:helm-values
    manager:kubernetes
    manager:kustomize
    manager:maven
    manager:meteor
    manager:mix
    manager:npm
    manager:nuget
    manager:pip_requirements
    manager:pip_setup
    manager:pipenv
    manager:poetry
    manager:ruby-version
    manager:sbt
    manager:swift
    manager:terraform
    manager:travis

</details>

"manager" is short for "package manager".
Add the relevant manager labels to the issue.
If there are multiple managers affected, add labels for all of them.

### New stuff

<details>
    <summary>New stuff</summary>

    new datasource
    new package manager
    new platform
    new versioning

</details>

Apply these labels when somebody opens a `feature` type issue requesting a new datasource, package manager, platform, or new versioning scheme.

### Platform

<details>
    <summary>Platform labels</summary>

    platform:azure
    platform:bitbucket
    platform:gitea
    platform:github
    platform:gitlab

</details>

Use these to mark the platform that is affected by this issue.
Keep in mind that a issue can be both affecting a platform and a self hosted instance.

### Worker

<details>
    <summary>Worker</summary>

    worker:branch
    worker:global
    worker:onboarding
    worker:pr

</details>

A worker is the "core" logic of Renovate.
