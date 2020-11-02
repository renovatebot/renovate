# Issue labeling

We try to keep issues well-classified by labeling them appropriately.
Only members/collaborators with the required rights can apply labels.

## Severity labels

<details>
    <summary>Severity labels</summary>

    breaking
    major

</details>

QUESTION: When/who should use these severity labels?

## Priority labels

<details>
    <summary>Priority labels</summary>

    pri0-blocker
    pri1-critical
    pri2-important
    pri3-normal
    pri4-low
    wontfix

</details>

Use these to assign a priority level to an issue.

QUESTION: Who gets to decide the priority level? @rarkins and maintainers, or can a triaging member select a priority level?

QUESTION: Maybe we should copy paste the priority descriptions from the labels into this doc?

## Type of issue labels

<details>
    <summary>Type of issue labels</summary>

    bug
    docs
    duplicate
    feature
    refactor

</details>

Use these to label the type of issue.
For example, use `bug` to label a bug type issue, and use `feature` for feature requests.
Only use `refactor` for code changes, don't use `refactor` for documentation type changes.

QUESTION: Do we even need a `duplicate` label, there's **mark as duplicate** functionality in GitHub nowadays...

## Housekeeping labels

<details>
    <summary>Housekeeping labels</summary>

    good first issue
    help wanted
    needs reproduction
    reproduced

</details>

Add a label `good first issue` to issues that are small, easy to fix, and do-able for a newcomer.

Add a label `needs reproduction` if the issue can only be fixed once there's a reproduction.
Add the label `reproduced` once there is a public reproduction.

QUESTION: When/who should use the `help wanted` label?

## Miscellaneous labels

<details>
    <summary>Miscellaneous labels</summary>

    gitfs
    hacktoberfest
    hacktoberfest-accepted
    internal
    ready
    self hosted

</details>

QUESTION: What is the `gitfs` label about?
QUESTION: Should we document the `hacktoberfest` labels?
QUESTION: What is the `internal` label about?
QUESTION: Do we even use the `ready` label now Renovate has a project board?
QUESTION: I think `self hosted` belongs in the `platform:` type label section instead???

### Datasource labels

<details>
    <summary>Datasource labels</summary>

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

QUESTION: What is a datasource? Where can I see if an issue is about a certain datasource? I have no idea what the backend files are that I can check....

## Manager labels

<details>
    <summary>Manager labels</summary>

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

QUESTION: What is a manager? What does it do? How can I see what manager is used in an issue?

## New labels

<details>
    <summary>New stuff labels</summary>

    new datasource
    new package manager
    new platform
    new versioning

</details>

Apply these labels when somebody opens a `feature` type issue requesting a new datasource, package manager, platform.

QUESTION: What is `new versioning` about??? I've no clue what this is...

## Platform labels

<details>
    <summary>Platform labels</summary>

    platform:azure
    platform:bitbucket
    platform:gitea
    platform:github
    platform:gitlab

</details>

Use these to mark the platform that is affected by this issue.

QUESTION: Should the `self hosted` label be in this category as well? Or are we missing a `platform:self-hosted` label?

## Worker labels

<details>
    <summary>Worker labels</summary>

    worker:branch
    worker:global
    worker:onboarding
    worker:pr

</details>

QUESTION: I have no clue what a worker even is....

## Semantic release bot labels

<details>
    <summary>Semantic release bot labels</summary>

    released
    semantic-release

</details>

The semantic release bot applies the `released` label whenever the fix for an issue is packaged into a new release.

QUESTION: I don't know what the `semantic-release` label is about.
