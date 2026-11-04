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

### Bucket

<details>
    <summary>Bucket labels</summary>

    bucket:ecosystem-depth
    bucket:new-ecosystem
    bucket:ecosystem-data
    bucket:platform
    bucket:security-supply-chain
    bucket:workflow-fit
    bucket:predictability
    bucket:observability
    bucket:performance-scale
    bucket:bug-fix
    bucket:engineering-health
    bucket:docs
    bucket:dependency-updates

</details>

Use these to label what _kind_ of work an issue, discussion or PR represents, independent of area (`manager:`/`platform:`/`core:`) and priority.
Unlike `type:*`, an item can carry more than one `bucket:` label: apply every one that fits, though most items take exactly one.

- `bucket:ecosystem-depth`: extends a manager, datasource or versioning Renovate _already_ supports, to cover something new in that ecosystem.
- `bucket:new-ecosystem`: a net-new manager, datasource or versioning scheme, where nothing exists for it yet.
- `bucket:ecosystem-data`: adds or corrects an entry in Renovate's curated knowledge of the package world, e.g. monorepo groupings, replacement/workaround presets, package-list presets. The deliverable is data, not behavior.
- `bucket:platform`: needs a platform's API (GitHub, GitLab, Azure DevOps, Bitbucket, Gerrit, Forgejo, Gitea, etc) — parity, platform-specific behavior, a new platform, or a migration forced by a platform deprecation.
- `bucket:security-supply-chain`: prevents a supply-chain attack, a bad release, or credential/execution exposure. Covers both protecting users and hardening Renovate itself.
- `bucket:workflow-fit`: "raise updates the way my org works" — grouping, scheduling, limits, automerge conditions, PR/commit presentation, reviewers, dashboard shape.
- `bucket:predictability`: makes Renovate do the expected thing, or fail loudly instead of silently — validation, config discovery, config migration, clearer warnings or log levels.
- `bucket:observability`: helps someone see what Renovate did or why — logs, OpenTelemetry, the Renovate Report, dry-run output, notifications.
- `bucket:performance-scale`: same behavior for less time/memory/API traffic, or working at a scale that currently degrades.
- `bucket:bug-fix`: supported behavior producing visibly wrong output — crashes, corruption, wrong versions, failed commands.
- `bucket:engineering-health`: maintainer-facing investment with no direct user-visible feature — deprecation removals, refactors, lint rules, CI, test coverage.
- `bucket:docs`: the deliverable is something users read — key-concept pages, deep dives, clarifications, restructuring, and generated reference material such as the JSON schema and option tables.
- `bucket:dependency-updates`: Renovate renovating Renovate, i.e. the bot's own update PRs and the Dependency Dashboard issue. Fully automated, so exclude it from any "incoming work" view.

Not every item needs a bucket: support questions, discussions still waiting on details, and announcements stay unbucketed.
Duplicates take the bucket of their canonical item, and anything authored by `renovate[bot]` is always `bucket:dependency-updates`.
When `workflow-fit`, `predictability` and `observability` all seem to fit, ask whether the user wants different _behavior_, to be _told_ something Renovate hides or gets wrong, or a new _lens_ on what happened.

Read the [bucket definitions](./bucket-definitions.md) for the full test, worked examples, near-miss redirects, and the rules for PRs, duplicates and unbucketed items.

### Motivation

<details>
    <summary>Motivation labels</summary>

    mend:customer-request
    competitive

</details>

Use these to record _why_ work matters, separately from _what_ it is.
Motivation is orthogonal to bucket: a Dependabot-parity item is still, concretely, a `bucket:ecosystem-depth` or `bucket:security-supply-chain` item that also happens to be `competitive`.
Keeping them separate lets us ask questions like "how much of our security bucket is competitive-driven?" instead of forcing one label to do both jobs.

### Lifecycle

<details>
    <summary>Lifecycle label</summary>

    lifecycle

</details>

Use `lifecycle` as a cross-cutting flag for a judgement about a dependency's life and health _beyond_ updating its version: abandonment/staleness detection, replacements for renamed or relocated packages, deprecations, end-of-life data, age/adoption/health metadata surfaced to the user.
The mechanism is metadata _about_ the dependency, not a version bump of it.
Apply it alongside a `bucket:*` label, not instead of one.

Don't use `lifecycle` for `minimumReleaseAge`/release-age gating (that's `bucket:security-supply-chain`, age as an attack window rather than dependency health), or for changelog fetching (that's about the update, not the dependency's life).

This is kept as a single cross-cutting label rather than its own bucket because it's a small share of volume (around 3% of ideas) scattered across several buckets: promote it to a full `bucket:*` label if that share grows.

### Rough edge

<details>
    <summary>Rough edge label</summary>

    rough-edge

</details>

Use `rough-edge` as a cross-cutting flag when all three hold: the irritation comes from one of Renovate's own surfaces (config discovery, PR/commit presentation, the dashboard, logs, the CLI, defaults, docs) behaving below reasonable expectation, rather than a gap in ecosystem or platform coverage, users hit it repeatedly in ordinary use, and it's irritating rather than blocking (a workaround exists or you live with it, with no failed runs, data loss or security exposure).
If any one fails, don't apply it.
Apply it alongside a `bucket:*` label, not instead of one.
The size of the fix is not a test: record effort separately (e.g. `good first issue`).

This is kept as a single cross-cutting label rather than its own bucket because it concentrates unevenly across buckets (measured at around half of `bucket:predictability`, `bucket:docs` and `bucket:bug-fix` items, versus around 5% of `bucket:ecosystem-depth` and `bucket:security-supply-chain`) rather than forming a bucket of its own.

### Audience

<details>
    <summary>Audience labels</summary>

    audience:user
    audience:operator
    audience:mend-hosted
    audience:maintainer

</details>

Use these to record _who_ feels the work, as a single label per item (unlike bucket, these are mutually exclusive).
Audience follows who feels the result, not who does the work, and where a reporter runs Renovate does not decide it on its own.

- `audience:user` (the default): configured in, or experienced through, repository config — the PRs Renovate raises, `renovate.json`, shared presets and org-inherited config, grouping, scheduling, presentation.
- `audience:operator`: lives in global config, environment, credentials infrastructure, or affects how the bot instance (not one repo) behaves — autodiscovery, scaling, CI resource use, fleet admin. When torn between user and operator, ask where the config key lives: repo config is user, global-only is operator. For keys allowed in both (`hostRules`, `binarySource`), ask who sets it in practice: credentials, tool installation and bot-wide limits are operator.
- `audience:mend-hosted`: specific to the Mend-hosted app's behavior or constraints, not reproducible on plain self-hosted.
- `audience:maintainer`: Renovate's own maintainers — repo CI, refactors, test tooling, release process.

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
    platform:forgejo
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

Add a label `auto:no-coverage-ignore` if PR authors avoid needed unit tests by v8 ignoring code with the `/* v8 ignore ... */` comment.

Add a label `auto:no-done-comments` if PR authors unnecessary "Done" comments, or type comments to ask for a review instead of requesting a new review through GitHub's UI.

Add a label `auto:reproduction` if nobody's reproduced it in a public repo yet and such a reproduction is necessary before further work can be done.

Add a label `auto:retry-latest` to any Discussion where the user should retry the latest version of Renovate to see if the problem persists.

### Self-hosted

<details>
    <summary>Self hosted</summary>

    self-hosted

</details>

Apply the `self-hosted` label when an issue is applicable only to users who self-administer their own Renovate instance.

## Automated check for Issues with missing labels

We have a GitHub Action (`find-issues-with-missing-labels.yml`) to find issues on our repository that are missing labels.
Any Issues with missing labels will be put in a list in a new "error" Issue.

The Action runs each week.

## Checking Module Label Coverage

Run `pnpm labels:check` to check whether all datasource, manager, and platform modules have matching GitHub labels.

Run `pnpm labels:show-commands` to print copy-pasteable `gh label create ...` commands for any missing labels.

### Apply the correct labels manually

The Action will _not_ fix any badly labeled issues.
This means that you, or we, must apply the correct labels to any affected Issue.
