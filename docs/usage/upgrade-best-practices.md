# Upgrade best practices

This page explains what we (the Renovate maintainers) recommend you do to update your dependencies.

We'll cover different situations like starting with a new project, or dealing with a project with five year old dependencies.
We also explain why you should update often, and how to nudge your team to actually update their dependencies.

## General recommendations

In general, we recommend that you:

- Run Renovate on every repository
- Extend from the `config:best-practices` preset instead of `config:recommended`
- Use the Dependency Dashboard issue (it's on by default)
- Update your dependencies often
- Read the changelogs for the updates
- Update to new `major` versions in good time
- Talk with your team about the update stategy

If you think Renovate is too noisy, please read our [noise reduction docs](./noise-reduction.md).

## About the `config:best-practices` preset

The `config:recommended` preset is meant to work for nearly all Renovate users.
We also want to have a preset with stronger opionions, that includes our upgrade best practices.
That's why we created the `config:best-practices` preset.

If you want to follow our upgrade best practices, you should extend from the `config:best-practices` preset:

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

#### Config migration

Renovate can create a config migration PR to replace old config option names with their new replacements.
This means your configuration and the Renovate docs always use the same terms.

#### Extends `config:recommended`

We like the `config:recommended` preset, it's a good fit for nearly all users.
So it makes sense to add our best practices on top of the recommended preset.

#### Extends `docker:pinDigests`

WIP: add reason(s) here.

#### Extends `helpers:pinGitHubActionDigests`

The [GitHub Docs, using third-party actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) recommend that you pin actions to a full length commit SHA.
We agree with this recommendation, so we use the `helpers:pinGitHubActionDigests` preset to pin GitHub Actions.

#### Extends `:pinDevDependencies`

WIP: add reason(s) here.

### Why updating often is easier, faster and safer

You may think that updating often is too noisy, and takes too much time.
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

If you're behind on updates you'll have a bad time, because you must read _more_ changelogs and make _more_ changes before you can merge the critical patch.

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

We recommend that you start by merging `patch` and `minor` updates.
Make sure to read the changelogs for your updates.
You may need to make minor changes before you can merge some updates.

After updating to the latest `patch` and `minor` versions, you can start getting `major` updates.
Again, start with the easy `major` version updates, like a Prettier or ESLint major update.

Now it's time to work on any `major` updates for your framework or library.
Take your time, read the changelogs, and make the necessary changes.
Let multiple team members review your work before you merge it, it's easy to miss something.

Finally, update your development tools.

Now that you're up to date, it's important to start thinking about how to make updating a regular thing.

## Project with five year old dependencies

Let's assume your Dependency Dashboard lists more than 50 updates, and you have a few `major` version updates pending.
If your project is this badly behind on updates, you have two problems.
The first problem is to get your dependencies back up to date, the second is improving your update process.

### Focus on critical updates first

Let's fix the easier problem first: getting back up to date.
First update any dependencies that have critical updates for CVEs or other security related improvements.

### Fix blocking updates

Next, update any dependency that's blocking another update.
You may need to update dependency `A` before you can take an update for dependency `B` or `C`.
In that case, update dependency `A` first.

### Update to latest `minor` or `patch` of current version

Then update all dependencies to their latest `minor` or `patch` version to prepare for dealing with `major` updates.

### Take `major` updates in sequence

We recommend you take `major` updates in sequence.
Taking `major` updates in sequence allows you to read the changelogs/blogs for each `major` version, and learn _why_ upstream made certain breaking changes.

Say you're on version `1` of a dependency, and the latest `major` version is at `4`.
You should update to `2`, then `3` and finally `4`.
Avoid updating from `1` directly to `4`.

### Update development tools

Finally update your development tools.

### Improve the human side

You're done with the _technical_ side, now you can start improving the _human_ side.
By improving the human side, you'll avoid ending up with outdated dependencies again.
Keep reading to learn how to deal with the human side of things.

## Why developers avoid updating

Let's assume that most developers _want_ a project that's up to date.
So why are developers not updating their project?
Some reasons why developers may avoid updating the project:

- Developers get blamed when things break in production
- There are no tests, so merging updates is scary
- Slow tests
- Releasing a new version of the project must be done by hand
- Updating is a manual process
- The company doesn't allow developer time for updates
- The company has complex rules about when to update

In short, if updating is painful, developers will avoid it.
The solution is to make it easy and fast to update dependencies.
Focus on the process, not on the people.

### Make updating easy and fast

- Make sure building the project is as fast as it can be
- Have automated tests for the critical path of your project
- Run the automated tests on every PR
- Enable [GitHub Merge Queue](./key-concepts/automerge.md#github-merge-queue) to speed up merges

### Talk with your team about the update process

Insert recommendations from Renovate maintainers here on how to deal with a team that doesn't want to apply updates, arguments to convince people to update often, dealing with team dynamics, and so on.

#### Ground rules

- Run Renovate bot on _all_ projects
- Avoid long lived branches that diverge from `main` over time
- Dig beyond "developer error" when things go wrong, focus on the process
- Ensure company policy allows frequent updates

## How we use Renovate

...

## How others use Renovate

Read the [Swissquote user story](https://docs.renovatebot.com/user-stories/swissquote/) to learn how they use Renovate to update their dependencies.
