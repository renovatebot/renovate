# Upgrade best practices

This page explains what we (the Renovate maintainers) recommend you do to update your dependencies.

We'll cover different situations like starting a new project, or updating a project with five year old dependencies.
We also explain why you should update often, and how to nudge your team to update their dependencies.

## General recommendations

In general, we recommend that you:

- Run Renovate on _every_ repository
- Extend from the `config:best-practices` preset instead of `config:recommended`
- Use the Dependency Dashboard issue (it's on by default)
- Update your dependencies often
- Read the changelogs for the updates
- Update to new `major` versions in good time
- Talk with your team about the update stategy

If you think Renovate is too noisy, please read our [noise reduction docs](./noise-reduction.md).

## About the `config:best-practices` preset

The `config:recommended` preset is the recommended configuration for most Renovate users.
We also have a `config:best-practices` preset that includes our upgrade best practices.

To follow our upgrade best practices, you should extend from the `config:best-practices` preset:

```json
{
  "extends": ["config:best-practices"]
}
```

If you're using `config:recommended` then replace it with `config:best-practices`:

```diff
- "extends": ["config:recommended"]
+ "extends": ["config:best-practices"]
```

### What's in the `config:best-practices preset?

The [`config:best-practices` preset](https://docs.renovatebot.com/presets-config/#configbest-practices) comes with this configuration:

```json
{
  "configMigration": true,
  "extends": [
    "config:recommended",
    "docker:pinDigests",
    "helpers:pinGitHubActionDigests",
    ":pinDevDependencies"
  ]
}
```

The next sections explain each part of the preset.

#### Config migration

Renovate creates a config migration PR to replace old config option names with their new replacements.
This way your configuration and the Renovate docs always use the same terms.

#### Extends `config:recommended`

The `config:recommended` preset is a good base to start from.
That's why we extend from it.

#### Extends `docker:pinDigests`

The [Renovate docs, Docker Digest pinning](https://docs.renovatebot.com/docker/#digest-pinning) section explains _why_ you should pin your Docker containers to an exact digest.

#### Extends `helpers:pinGitHubActionDigests`

The [GitHub Docs, using third-party actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) recommend that you pin GitHub Actions to a full-length commit SHA.
We agree with GitHub, and go further, because we recommend pinning _all_ Actions.

The `helpers:pinGitHubActionDigests` preset pins all GitHub Actions.

#### Extends `:pinDevDependencies`

Pinning your development dependencies means you, and your team, are using the same versions of development tools.
This makes the developer-tool side of your builds reproducible.
Debugging faulty versions of your tools is easier, because you can use Git to check out different versions of the tools.

### Why updating often is easier, faster and safer

You may think that updating takes too much time.
But updating regulary actually _saves_ you time, because:

- Regular updates tend to be small
- Applying `major` updates is easier
- You'll be ready for CVE patches
- You'll look for ways to automate the updates

#### Regular updates tend to be small

Firstly, when you update regularly updates tend to be small.
The update's changelogs are small, quick to read, and easy to understand.
You probably only need to make changes in a few places (if at all) to merge the PR and get going again.
Because you're reading the changelogs regularly, you'll get a feel for the direction of the upstream project.

#### Applying `major` updates is easier

Secondly, when you're current with upstream, `major` updates are easier.
This is because you already:

- follow the latest best practices of upstream
- use the latest names for features/variables
- read the previous changelogs

#### You'll be ready for CVE patches

Thirdly, you'll be ready when a upstream package releases a patch for a critical CVE.
If you're current, you can review and merge Renovate's PR quickly.

When you're behind on updates, you'll have a bad time, because you must read _more_ changelogs and make _more_ changes before you can merge the critical patch.

#### You'll look for ways to automate the updates

Finally, when you're updating often, you'll start looking for ways to automate the updates.
You may start to [`automerge`](./configuration-options.md#automerge) development dependencies like Prettier, or ESLint when the linter passes.
Or you may decide to automerge any `patch` type upgrades, by using the [`default:automergePatch`](https://docs.renovatebot.com/presets-default/#automergepatch) preset.

You may also start using [GitHub's pull request merge queues](./key-concepts/automerge.md#github-merge-queue) to speed up the merge process.
Renovate does not support GitLab's Merge Trains, see [issue #5573](https://github.com/renovatebot/renovate/issues/5573).

## Starting from a new project

Let's assume you start a new project.
You created a new Git repository, installed the latest frameworks, libraries and development tools.
After pushing the initial commit, you should enable and onboard Renovate.

Now you'll have to stay on the "update often" train.

## Project with one year old dependencies

If you have a project that's a year behind on dependencies, you'll need to do some work.
Let's assume that most dependencies need a `patch` or `minor` update, and at _least_ one dependency needs a `major` update.
We recommend you start small, and do the easier updates first.

Start with the `patch` and `minor` updates.
Read the changelogs for your updates.
You may have to make small changes to get things working again.

When you have the latest `patch` and `minor` versions, you are ready for `major` updates.
Start with `major` version updates for tools like Prettier or ESLint.

Then work on `major` updates for your framework or library.
Take your time, read the changelogs, and make the necessary changes.
Let multiple team members review your work before merging, it's easy to miss something.

Finally, update your development tools.

Now that you're up to date, it's important to start thinking about how to make updating a regular thing.

## Project with five year old dependencies

Let's assume your Dependency Dashboard lists more than 50 updates, and you have a few `major` version updates pending.
If your project is this badly behind on updates, you have two problems:

- Updating your dependencies
- Improving your update process

### Focus on critical updates first

Let's fix the easier problem first: getting back up to date.
First update any dependencies that have critical updates for CVEs or other security related improvements.

If you're on the GitHub platform: follow the steps listed in the [`vulnerabilityAlerts`](https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts) docs to make sure Renovate is reading GitHub's Vulnerability Alerts.

You may want to enable the experimental `osvVulnerabilityAlerts` config option, to get OSV-based vulnerability alerts for _direct_ dependencies.
Read the [`osvVulnerabilityAlerts` config option docs](https://docs.renovatebot.com/configuration-options/#osvvulnerabilityalerts) to learn more.


### Fix blocking updates

Next, update any dependency that's blocking another update.
You may need to update dependency `A` before you can update dependency `B` or `C`.
In that case, update dependency `A` first.

### Update to latest `minor` or `patch` of current version

Then update all dependencies to their latest `minor` or `patch` version to prepare for dealing with `major` updates.

### Take `major` updates in sequence

We recommend you get `major` updates in sequence.
You'll read the changelogs for each `major` version, and often learn _why_ upstream made certain breaking changes.

Say you're on version `1` of a dependency, and the latest `major` version is at `4`.
You should update to `2`, then `3` and finally `4`.
Avoid updating from `1` directly to `4`.

### Update development tools

Finally update development tools like Prettier, ESLint, TSLint, Cypress, and so on.

### Improve the human side

You're done with the _technical_ side.
Now comes the harder part, fixing the _human_ side.
There are probably a number of reasons why the project got this badly out of date.

When working on the human side, focus on the process, rules, and habits.
Avoid blaming developers for not updating often.

## Why developers avoid updating

Let's assume most developers _want_ a project that's up to date.
So why are your developers avoiding updates?
Here's a list of common reasons:

- Developers get blamed when things break in production
- There are no tests, so merging updates is scary
- The test suite is slow
- Releasing a new version of the project must be done by hand
- Updating must be done by hand
- The company doesn't allow developer time for updates
- The company has complex rules about when to update

In short, if updating is painful, developers will avoid it.
The solution is to make it easy and fast to update dependencies.
Again: focus on the process, not on the people.

### Talk with your team about the update process

Listen to your team, write down their problems.
Make time to fix each problem as best as you can.

### Make updating easy and fast

In short, respect your developer's time and brains.

- Use Renovate to propose updates for dependencies
- Building the project _must_ be as fast as possible
- Have automated tests for the critical path of your project
- Run the automated tests on _every_ pull request
- Enable [GitHub Merge Queue](./key-concepts/automerge.md#github-merge-queue) to speed up merges
- Use the [`semantic-release`](https://github.com/semantic-release/semantic-release) bot to automate the release process
- Follow SemVer versioning

#### Ground rules

As a starting point:

- Run Renovate on _all_ projects
- Avoid long lived branches that diverge from `main` over time
- Dig beyond "developer error" when things go wrong, again: focus on the process
- Ensure company policy allows frequent updates

## How we use Renovate

- We run Renovate on all repositories
- Most of our repositories have automated tests for the critical path of the application
- We automerge some dependencies, but request `major` updates from the Dependency Dashboard
- When a developer merges a breaking change, we revert to a known-good version, and try again later
- We automated the release with the [`semantic-release`](https://github.com/semantic-release/semantic-release) bot
- We spend time to make our build and automated tests as fast as possible

## How others use Renovate

Read the [Swissquote user story](https://docs.renovatebot.com/user-stories/swissquote/) to learn how they use Renovate to update their dependencies.

## Recommended reading

There's a lot of good information out there, so we can only highlight a few resources.

Martin Fowler has two great resources:

- The free page [Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html) to help you decide what Git branch pattern to use
- The book [Refactoring, Improving the Design of Existing Code](https://martinfowler.com/books/refactoring.html) to help your developers gradually refactor to clean, modular and easy to read code

The `git bisect` command can help you find out which commit introduced a bug, or other behavior change.
Read the [ProGit 2 book, section on binary search](https://git-scm.com/book/en/v2/Git-Tools-Debugging-with-Git#_binary_search) to learn more.
