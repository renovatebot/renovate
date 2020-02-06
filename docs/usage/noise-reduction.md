---
title: Noise Reduction
description: How to reduce the "noise" associated with module updates
---

# Noise Reduction

Generally, the first reaction people have to automated dependency updates like Renovate is "oh great/feel the power of automation". The next reaction a few days or weeks later is often "this is getting overwhelming". Indeed, if you leave Renovate on its default settings of raising a PR every single time any dependency receives any update.. you will get a lot of PRs and related notifications. This document will give you some ideas of how to reduce the amount of "noise" in your repository and the Pros/Cons of each.

Of course, please keep in mind that people's definitions of "noise" may differ. For some people, it's noisy only if they get a notification or email from GitHub. For others, too many commits in their `master` branch may be "noise". In other words, your mileage may vary. Please contact the author if you have any ideas on this topic!

## Package Grouping

To reduce noise, you can reduce the number of updates in total, and a good way to do that is via intelligent grouping of related packages.

As an example, our default `":app"` and `":library"` [presets](/config-presets/) include the rule `"group:monorepos"`, which means that "sibling" packages from known monorepos will always be grouped into the same branch/PR by renovate. For example, all `@angular/*` packages that are updated at the same time will be raised in a "Renovate angular monorepo packages" PR. And every package in the React monorepo will be grouped together in a React monorepo PR too.

You may wish to take this further, for example you might want to group together all packages related to `eslint`, even if they come from separate repositories/authors. In that case you might add config like this:

```json
  "packageRules": [
    {
      "packagePatterns": [ "eslint" ],
      "groupName": "eslint"
    }
  ]
```

By setting `packagePatterns` to "eslint", it means that any package with eslint anywhere in its name will be grouped into a `renovate/eslint` branch and related PR.

**Caution**: Any time you group dependencies together, you naturally increase the chance that the branch will have an error ("break" your build). When you have more than one package upgrade in a PR, it's going to take you longer to work out which one broke than if they were all in separate PRs. Also, you will be held up upgrading all those dependencies until they all pass. If you weren't grouping, then you could keep upgrading all dependencies except the one that fails, instead of being held up. You will also have less flexibility about what to do when one or more in the group have a major upgrade and may break the others.

## Scheduling Renovate

On its own, the Renovate cli tool runs once and then exits. Hence it only runs as often as its administrator sets it to (e.g. via `cron`). For the [Renovate app on GitHub](https://github.com/apps/renovate), it currently runs continuously using a job queue that gets refreshed hourly, or when you make relevant commits to your repository. Therefore, you can expect to get PRs at any time of the day, i.e. soon after versions are published to npm.

Receiving PRs at any hour can increase the feeling of being "overwhelmed" by updates and possibly interrupt your flow during working hours, so many Renovate users also consider reducing Renovate's schedule to be outside their normal working hours, for example weeknights and weekends. This is achievable by configuring `schedule` in your Renovate config and optionally `timezone` (Renovate's default time zone is UTC, so you may find it easier to write schedules if you override `timezone` to your local one).

Another example of adjusting schedules to fit with your workflow might be if your company performs releases every Monday. In that case, you might schedule Renovate to run every Tuesday after midnight to pick up new dependency updates that you can test over the following week before the next release.

**Caution**: You need to make sure you leave yourself and Renovate enough time in a week to actually get all your updating and merging done. There are multiple reasons why Renovate may need to "recreate" PRs after you merge another:

1.  Conflict with `package.json` (sometimes)
2.  Conflict with lock files (often)
3.  If you have configure Renovate or GitHub that PRs must always be kept up-to-date with master

Any of the above reasons can lead to a Renovate branch being considered "stale" and then Renovate needs to rebase it off `master` before you can test and merge again, and Renovate won't do this until it's back in schedule.

#### Selective scheduling

Don't think that you need to apply blanket rules to scheduling. Remember that Renovate configuration is highly flexible so you can configure `automerge` anywhere from globally (entire repo) right down to a package/upgrade type level (e.g. you could even configure a nonsensical rule that patch updates of `jquery` are for Mondays only).

Remember earlier our example of grouping all `eslint`? If you think about it.. updates to `eslint` rules don't exactly need to be applied in real time! You don't want to get too far behind, so how about we update `eslint` packages only once a month?

```json
  "packageRules": [
    {
      "packagePatterns": [ "eslint" ],
      "groupName": "eslint",
      "schedule": ["on the first day of the month"]
    }
  ]
```

Or perhaps at least weekly:

```json
  "packageRules": [
    {
      "packagePatterns": [ "eslint" ],
      "groupName": "eslint",
      "schedule": ["before 2am on monday"]
    }
  ]
```

If you're wondering what is supported and not, under the hood, the schedule is parsed using [later.js](https://bunkat.github.io/later/) using the `later.parse.text(scheduleString)` API. [This page](https://bunkat.github.io/later/parsers.html#text) explains the supported syntax or you can experiment on the [RunKit playground](https://npm.runkit.com/later).

## Automerging

Automerging is a Renovate feature that can save you a lot of time/noise directly, while also benefiting grouping and scheduling. In short: it means that Renovate can merge PRs or even branches itself if they pass your tests.

It is recommended that you enable automerge for any types of dependency updates where you would just click Merge anyway. We all know that there are some types of updates that we (nearly) always verify manually before merging, and plenty of others that we don't bother looking at unless tests fail. Every time you click Merge on a Renovate PR without manually testing it, you should consider if you can enable automerge and save yourself the time in future.

Automerge works particularly well for `devDependencies` and for production `dependencies` that have great test coverage.

For example, if you have `jest` or `mocha` as a dependency, and it has an upgrade with passing tests.. automerge them! If you have a linter like `eslint` or `tslint` and its update passes.. automerge them! If you have an API with 100% test coverage and `express` is updated.. automerge it!

#### Branch automerging

Those of you familiar with GitHub might note that even if you automerge PRs, you are still going to get notifications (noise) anyway - one when the PR is created and another when it is merged. For this reason we recommend you consider setting `automergeType=branch` which will mean:

- Renovate first creates a branch and no PR
- If tests pass, Renovate pushes a commit directly to `master` without PR
- If tests fail, Renovate raises a PR for you to review

The result is that passing updates are essentially "silent" - the only sign of them are the commits to your `master` branch.

#### Automerging and scheduling

Automerging is particularly beneficial if you have configured a schedule, because Renovate on its own may be able to automerge the majority of your updates. And this is especially so if your repository needs rebasing, e.g. because you use lock files. e.g. let's say you have dependencies `abc` and `xyz` with upgrades, and you use a `yarn.lock` file.

- At the start of the schedule, `Renovate` will create branches for `abc` and `xyz` upgrades, including `yarn.lock` updates
- After `abc` passes tests, `Renovate` will automerge it to `master`
- The `xyz` branch probably now has `yarn.lock` conflicts
- Renovate will immediately check all other branches and rebase them
- The change to `xyz` branch will trigger another round of CI tests
- After the updated `xyz` branch passes, Renovate will automerge it too

This is a lot better than you waking up to two PRs and then having to deal with conflicts yourself after you merge the first one.

Remember our running `eslint` example? Let's automerge it if all the linting updates pass:

```json
  "packageRules": [
    {
      "packagePatterns": [ "eslint" ],
      "groupName": "eslint",
      "schedule": ["before 2am on monday"],
      "automerge": true,
      "automergeType": "branch"
    }
  ]
```

Have you come up with a rule that you think others would benefit from? How about a PR back to [renovate-config](https://github.com/singapore/renovate-config) with the above rule named `":automergeEslintWeekly"` ?

## Lock file considerations

As mentioned earlier, using lock files greatly increases the chance that merging one PR will result in a second PR becoming conflicted with `master`. Therefore:

- The more groups you use, the separate PRs you have, and hence the less overall chance at lock file conflicts
- The less your schedule, the more chance that you pile up concurrent PRs, which increases the chance of lock file conflicts
- The more automerging you do, the less chance you have concurrent PRs, which decreases the chance of lock file conflicts

## The Future of Noise Reduction

First of all, if you ever have any ideas about how to make Renovate less noisy, please raise or comment on issues in the [main repository](https://github.com/renovatebot/renovate). Our philosophy is:

1.  Nearly everyone should probably use Renovate-like dependency update automation
2.  Over time, you should "see" Renovate less and less

One of our hopes with preset configs is that a set of "sensible" configs can be maintained by the community that combine grouping, scheduling and automerging to reduce the amount of noise in repositories with little downside or increased risk. Such lists could be maintained and used somewhat like Adblock lists - kept up to date by maintainers but for the majority of users they are simply trusted/automatic/invisible.
