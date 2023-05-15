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

If you think Renovate is too noisy, please read our [noise reduction docs](INSERT LINK HERE).

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
If you're current, you can review and merge Renovate's PR and be done.
If you're badly behind on updates you'll have a bad time because you must read _more_ changelogs and make _more_ changes before you can merge the critical patch.

To summarize: be kind to future you, and update your dependencies often.

## Starting from a new project

Let's assume you start a new project.
You've created a new Git repository, installed the latest frameworks, libraries and development tools.
After pushing the initial commit, you should enable and onboard Renovate.

Now you'll have to stay on the "update often" train.

## Project with one year old dependencies

If you have a project that's a year behind on dependencies, you'll need to do some work.
Let's assume that most dependencies need some `minor` or `patch` level updates, and at _least_ one dependency needs a `major` update.

Here we recommend that you start with the easy stuff first, to get back in the groove.
So update your dependencies to the latest `minor` or `patch` versions, and read their changelogs.
You'll probably need to make some tiny changes before merging some updates, but it's easy if you do it one at a time.

Once you've updated your old `major` versions, it's time to tackle the new `major` updates.
Again, start with the easy `major` version updates.

Finally it's time to tackle the `major` update for your framework or critical library.
Take your time, carefully read the changelogs, and make the necessary changes.
Let multiple team members review your work before you merge it, it's easy to miss something.

At the end you'll be fully up to date.
To make life easier for you the next time, make sure to regulary update your dependencies.

## Project with five year old dependencies

Let's assume your Dependency Dashboard lists more than 50 updates, and you have a few `major` version updates pending.

We recommend that you first update any dependencies that have critical updates for CVEs or other security related improvements.
Then update your framework tooling so you're current again.

...

## Getting your team to update dependencies

Insert recommendations from Renovate maintainers here on how to deal with a team that doesn't want to apply updates, arguments to convince people to update often, dealing with team dynamics, and so on.

## How we use Renovate ourselves

...
