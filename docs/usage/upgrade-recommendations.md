# Upgrade best practices

This page explains what we (the Renovate maintainers) recommend you do to update your dependencies.

We'll cover different situations like starting with a new project, or dealing with a project with five year old dependencies.
We also explain why you should update often, and how to nudge your team to actually update their dependencies.

## General recommendations

In general, we recommend that you:

- Run Renovate on every repository
- Enable the Dependency Dashboard (it's on by default)
- Update your dependencies often
- Read the changelogs for the updates
- Update to new `major` versions in good time
- Talk with your team about the update stategy

If you think Renovate is too noisy, please read our [noise reduction docs](./noise-reduction.md).

### Why updating often is easier, faster and safer

You may think that updating often is too noisy, and takes too much time.
But updating regulary actually _saves_ you time, because:

- Regular updates tend to be small
- Applying `major` updates is easier
- You'll be ready for CVE patches

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

If you're badly behind on updates you'll have a bad time, because you must read _more_ changelogs and make _more_ changes before you can merge the critical patch.

## Starting from a new project

Let's assume you start a new project.
You've created a new Git repository, installed the latest frameworks, libraries and development tools.
After pushing the initial commit, you should enable and onboard Renovate.

Now you'll have to stay on the "update often" train.

## Project with one year old dependencies

If you have a project that's a year behind on dependencies, you'll need to do some work.
Let's assume that most dependencies need some `minor` or `patch` level updates, and at _least_ one dependency needs a `major` update.

We recommend that you start with the easy stuff first, to get back in the groove.
So update your dependencies to the latest `minor` or `patch` versions, and read their changelogs.
You may need to make minor changes before merging some updates.

Once you've updated your old `major` versions, it's time to tackle the new `major` updates.
Again, start with the easy `major` version updates, like a Prettier or ESLint major update.

Now it's time to work on the `major` update for your framework or library.
Take your time, carefully read the changelogs, and make the necessary changes.
Let multiple team members review your work before you merge it, it's easy to miss something.

Finally, update your development tools.

Now that you're up to date, it's important to start thinking about how to make updating a regular thing.

## Project with five year old dependencies

Let's assume your Dependency Dashboard lists more than 50 updates, and you have a few `major` version updates pending.
If a project becomes this badly behind on updates, you have a bigger problem than just the updates.
Let's deal with the easier stuff first: getting back up to date, and deal with the big problem after that.

First update any dependencies that have critical updates for CVEs or other security related improvements.

Next, update any dependency that's blocking another update.
You may need to update dependency `A` before you can take an update for dependency `B` or `C`.
In that case, update dependency `A` first.

Then update all dependencies to their latest `minor` or `patch` version to prepare for dealing with `major` updates.

We recommend you take `major` updates in sequence.
Say you're on version `1` of dependency `A`, and the latest `major` version is at `4`.
You should update to `2`, then `3` and finally `4`.
Avoid updating from `1` directly to `4`.
Taking `major` updates in sequence allows you to read the changelogs/blogs for each `major` version, and learn why upstream made certain breaking changes.

Finally update your development tools.

You're done with the _technical_ side of things, but you still need to work on the _human_ side.
If you don't fix the human side, you'll end up with outdated dependencies again.
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

Insert recommendations from Renovate maintainers here on how to deal with a team that doesn't want to apply updates, arguments to convince people to update often, dealing with team dynamics, and so on.

Here's my short list:

- Run Renovate bot on all projects
- Make sure building the project is as fast as it can be
- Run automated tests on each PR
- Have automated tests for the critical path of your project
- Avoid long lived branches that diverge from `main` over time
- Ensure company policy allows frequent updates
- Dig beyond "developer error" when things go wrong, focus on the process

## How we use Renovate ourselves

...
