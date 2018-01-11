---
date: 2017-07-26
title: Should you Pin your Javascript Dependencies?
categories:
  - deep-dives
description: The pros and cons of dependency pinning for Javascript/npm
type: Document
order: 20
---

Once you start using a tool/service like Renovate, probably the biggest decision you need to make is whether to "pin" your dependencies instead of using semver ranges. The answer is "It's your choice", however we can certainly make some generalisations/recommendations to help you. Jump to the bottom conclusions if you get impatient.

## What is Dependency Pinning?

To ensure we're all talking about the same thing, it's important to define exactly what we mean by dependency "pinning".

Typically, projects use semver ranges in their `package.json`. For instance, if you run `npm i foobar` you will see an entry like `"foobar": "^1.1.0"` added to your `package.json`. Verbosely, this means "any foobar version greater than or equal to 1.1.0 but less than 2". Therefore the project will automatically use 1.1.1 if it's released, or 1.2.0, or 1.2.1, etc - meaning you will get not only patch updates but also feature (minor) releases too.

Another alternative is ranges like `"foobar": "~1.1.0"` which means "any foobar version greater than or equal to 1.1.0 but less than 1.2". This narrows the range to only patch updates to the 1.1 range.

If instead you "pin" your dependencies rather than use ranges, it means you use exact entries like `"foobar": "1.1.0"` which means "use only foobar version 1.1.0 and no other".

## Why use ranges?

For projects of any type, the main reason to use ranges is so that you can "automatically" get bug fixes - which may even include security fixes. By "automatically", we mean that any time you run `npm install` you will get the very latest version matching your semver - assuming you're not using a lock file, that is.

#### Tilde vs Caret

If you're familiar with the theory of semver, you might think that you only need to use tilde ranges (e.g. `"~1.1.0"`) to get bug fixes, rather than caret ranges (e.g. `"^1.1.0"`). This is true in theory but not in practice. The reality is that for most projects, fixes are not "backported" to previous minor releases, and minor releases themselves may include fixes. So for example release `1.2.0` may include one new feature and one fix, so if you stick with `1.1.0` then you will miss out on the fix as there will never be a `1.1.1` once `1.2.0` is already released. This is the _reality_ of most open source packages.

#### Ranges for Libraries

A second reason for using ranges applies to "libaries" that are published as npm packages with the intention that they are used/`require()`'d by other packages. In this case, it is usually a bad idea to pin all your dependencies because it will introduce an unnecessarily narrow range (one release!) and cause most users of your package to bloat their `node_modules` with duplicates.

For example, you might have pinned `foobar` to version `1.1.0` and another author pinned his/her `foobar` to dependency to `1.2.2`. Any user of both your packages will end up with npm attempting to install two separate versions of `foobar`, which might not even work. Even if both projects use a service like Renovate to keep their pinned dependencies up to date with the very latest versions, it's still not a good idea - there will always be times when one package has updated/released before the other one and they will be out of sync. e.g. there might be a space of 30 minutes where your package specifies foobar `1.1.0` and the other one specifies `1.1.1`.

## Why pin dependencies?

The main reason to pin dependencies is "certainty". When you pin dependencies, you know exactly which version of each dependency is installed at any time. This benefits when upgrading versions as well as when rolling back in case of problems.

#### Upgrading pinned versions

Let's say that a "faulty" version `1.2.0` of `foobar` is released and it breaks one of your tests.

If you were using default caret semver ranges, then your `master` branch is now "broken" because its `package.json` says that any version 1.x above 1.1.0 is acceptable, and npm will choose the latest (`1.2.0`). You would need to manually check and work out which dependency caused the failure (`foobar` may not have been the only dependency to have "automatically" upgraded) and then you would need to pin the dependency yourself to stop `npm` installing `1.2.0`.

Consider if instead you were _pinning_ dependency versions and the same thing happened. Your `master` would not be broken because it's pinned to `foobar@1.1.0` - instead you'd just have a Pull Request for upgrading to `foobar@1.2.0` which would fail. You'd know not to merge it and can wait for `foobar@1.2.1` or later when it's fixed.

Now consider a similar theoretical scenario where `foobar@1.2.0` is faulty but it is _not_ caught by any of your automated tests. This is more common and more dangerous.

If you were using semver ranges then this new version of `foobar` will likely be deployed to production before you notice errors and need to roll back. Like before, you need to manually work out which dependency caused it and pin it manually by editing `package.json` one dependency at a time.

If you were instead pinning `foobar` then you would receive a PR for `foobar@1.2.0` which awaits your approval. So first of all, you can choose to read the release notes and/or visually inspect the branch yourself before merging, hopefully saving you from pushing this faulty code to production.

If you did not catch the fault before merging, you are still better off with a pinned version. If you discover something wrong in production, you can easily "roll back" commits in your development environment until you find which it was. Then you can simply revert that commit (updating `foobar@1.1.0` to `foobar@1.2.0`) and push that to `master`. When the next release of `foobar` comes out (e.g. `1.2.1`) you will be prompted with a new PR and hopefully inspect it carefully this time before merge!

As you can see in the above, pinning dependencies makes your build more consistent and predictable as a developer.

#### Downside of pinned dependencies - upgrade "noise"

The one major downside to your development workflow of pinning dependencies is the potential for increased "noise" in your repository. As mentioned above, you can expect to receive Pull Requests whenever there is a new version of your dependencies available. Depending on how many repositories you maintain, and how many dependencies are in each, you may find this default approach to be overwhelming (e.g. waking up to 10 new Pull Requests each day).

## Reducing the "noise" of dependency updates

The increased volume of Pull Requests for upgrading dependencies may be considered by some to be undesirable "noise" in their day. To some extent this is simply a trade-off for having your dependencies pinned and predictable, however there are also ways you can reduce this noise while still gaining the majority of the benefits:

##### Pull Request automerging

There are some dependencies that either (a) don't have the potential to break something in production, or (b) are fully tested by your tests.

For example, it's essentially impossible for `eslint` to break anything in production. If your build/tests pass, then you are fine. Therefore you should consider enabling automerge for all lint packages to save yourself the pointless click. In this case you might wake up to 5/10 of your overnight Pull Requests having already merged themselves.

Another example of a good candidate for automerging might be a database driver like `node-postgres` (`pg` on npm), if you have 100% test coverage of your API. In that case if the `pg` package has a minor or patch update and passes all tests then you may as well merge it automatically if you were not going to do a manual inspection anyway.

##### Branch automerging

In the above suggestion of Pull Request automerging, you might still find it annoying if you receive GitHub Notifications for every PR that is created and merged. In that case, you could set `automergeType` to `branch-push`, which means Renovate will:

* Create a new branch for testing
* Wait until after tests have completed
* Push the commit directly to `master` if tests pass, or
* Raise a PR only if tests failed

With this approach, updates will be essentially "silent" - causing no notifications - but you will be able to see each commit on `master` of course.

##### Scheduling

Although it can feel satisfying to receive updates "immediately" when they're available, the reality is that you usually don't _need_ updates so frequently. And worse still, npm package versions that are less than 24 hours [can be unpublished](http://blog.npmjs.org/post/141905368000/changes-to-npms-unpublish-policy), which would really break your build if you've pinned to a version that no longer exists.

So to reduce the interruptions of automated dependency updates, consider putting Renovate on a schedule, such as:

* Update only on weekends? This way you update packages at most once per week, _and_ your CI build runners are likely to be idle anyway.
* Update daily, but between hours like midnight and 5am? That way notifications don't pop up in people's feed while they're working, _and_ you also get the benefit of not tying up build machines when developers need to use them.

##### Grouping related packages

Although it's good to isolate each dependency update for ease of troubleshooting, there are times when the extra noise isn't worth it, or when packages naturally belong together anyway (such as all `babel` packages). You can add a package rule in our Renovate configuration to group these together and you'll get just one branch combined even if multiple packages have updates available.

## Pinning Dependencies and Lock Files

Since both `yarn` and `npm@5` now support lock files, it's a common question to ask "Why should I pin dependencies if I'm already using a lock file?". It's a good question!

![broken-lockfile](/images/broken-lockfile.jpg)

Lock files are a great companion to semver ranges _or_ pinning dependencies, because these files lock (pin) deeper into your dependency tree than you see in `package.json`.

#### What a lock file will do for you

A lock file will lock down the exact dependencies and _sub_-dependencies that your project uses, so that everyone running `npm install` or `yarn install` will install the exact same dependencies as the person or bot that last updated the lock file.

To reuse an earlier example, this means that you could have `foobar@^1.1.0` in your `package.json` and be locked to `1.1.0` in your lock file, so that when the broken `foobar@1.2.0` is released, nobody on the team installs it.

#### What a lock file doesn't do for you

The lock file has only delayed the inevitable break.

![all-dead](/images/all-dead.jpg)

As soon as anyone needs to update the lock file (e.g. to add a new dependency, update a feature release of an existing dependency, or simply to refresh the lock file in order to get important patch updates), then your build will then break, because `foobar@1.2.0` will get installed. Whoever is in that process of updating the `package.json` or refreshing the lock file will be left wondering if it was their change that did it, or something else (the answer is probably: "something else"). And they still need to do what we described earlier before lock files and check dependency-by-dependency and version-by-version until they find which dependency broke. It doesn't make sense that every developer needs to be proficient in this type of troubleshooting just because they are the unlucky person who updates `package.json` the first time after a bad dependency is released.

Once again, if `foobar` had been pinned to `1.1.0` then it would never have been upgraded to the broken `1.2.0` version "by accident" and rolling it back would again be a matter of reverting the offending commit and regenerating the lock file. New features or updates would not have been held back because of this.

Essentially, the lock file does not solve the same semver problems that pinning solves - but it compliments it. For this reason we recommend using a lock file regardless of whether you pin dependencies or not.

## So what's best?

We recommend:

1. Any apps (web or node.js) that aren't `require()`'d by other packages should pin all types of dependencies for greatest reliability/predictability.
2. Browser or dual browser/node.js libraries that are consumed/`required()`'d by others should keep using semver ranges for `dependencies` but can use pinned dependencies for `devDependencies`.
3. Node.js-only libraries can consider pinning all dependencies, because application size/duplicate dependencies are not as much a concern in node.js compared to the browser.
4. Use a lock file if you can.

As noted earlier, when you pin dependencies then you will see an increase in the raw volume of dependency updates, compared to if you use ranges. If/when this starts bothering you, add Renovate rules to reduce the volume, such as scheduling updates, grouping them, or automerging "safe" ones.
