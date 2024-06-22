---
title: Noise Reduction
description: How to reduce the "noise" associated with module updates
---

# Noise Reduction

Generally, the first reaction people have to automated dependency updates like Renovate is "oh great/feel the power of automation".
The next reaction a few days or weeks later is often "this is getting overwhelming".
Indeed, if you leave Renovate on its default settings of raising a PR every single time any dependency receives any update.. you will get a lot of PRs and related notifications.
This document will give you some ideas of how to reduce the amount of "noise" in your repository and the Pros/Cons of each approach.

Of course, please keep in mind that people's definitions of "noise" may differ.
For some people, it's noisy only if they get a notification or email from GitHub.
For others, too many commits in their base branch may be "noise".
In other words, your mileage may vary.
If you have any ideas on this topic, please contact the author by starting a [new discussion on the Renovate repository](https://github.com/renovatebot/renovate/discussions).

## Package Grouping

To reduce noise, you can reduce the number of updates in total, and a good way to do that is via intelligent grouping of related packages.

As an example, our default `":app"` and `":library"` [presets](./config-presets.md) include the rule `"group:monorepos"`, which means that "sibling" packages from known monorepos will always be grouped into the same branch/PR by renovate.
For example, all `@angular/*` packages that are updated at the same time will be raised in a "Renovate angular monorepo packages" PR.
And every package in the React monorepo will be grouped together in a React monorepo PR too.

You may wish to take this further, for example you might want to group together all packages related to `eslint`, even if they come from separate repositories/authors.
In that case you might create a config like this:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["eslint"],
      "groupName": "eslint"
    }
  ]
}
```

By setting `matchPackagePatterns` to "eslint", it means that any package with ESLint anywhere in its name will be grouped into a `renovate/eslint` branch and related PR.

### Be smart about grouping dependencies

Grouping dependencies _may_ help you, but can also cause problems.
Sometimes you're better off getting a single PR per dependency!

Grouping dependencies versus single PRs:

- Grouping dependencies increases the chance that the branch has an error ("break" your build)
- When you upgrade multiple dependencies in one PR, it takes longer to find out which package broke the build
- If a group PR "breaks", you'll have to wait upgrading your other dependencies until _all_ updates in the PR pass
- You will have less flexibility when one (or more) dependencies in the group have a major upgrade, but the other dependencies are good to go

## Scheduling Renovate

For a high level overview of scheduling when Renovate bot runs, read the [key concepts, scheduling](./key-concepts/scheduling.md) docs.

On its own, the Renovate CLI tool runs once and then exits.
Hence, it only runs as often as its administrator sets it to (e.g. via `cron`).

For [the Mend Renovate App](https://github.com/apps/renovate), it currently runs continuously using a job queue that gets refreshed hourly, or when you make relevant commits to your repository.
You can expect to get PRs at any time of the day, e.g. soon after versions are published to npm.

Receiving PRs at any hour can increase the feeling of being "overwhelmed" by updates and possibly interrupt your flow during working hours, so many Renovate users also consider reducing Renovate's schedule to be outside their normal working hours, for example weeknights and weekends.
This is achievable by configuring `schedule` in your Renovate config and optionally `timezone` (Renovate's default time zone is UTC, so you may find it easier to write schedules if you override `timezone` to your local one).

Another example of adjusting schedules to fit with your workflow might be if your company performs releases every Monday.
In that case, you might schedule Renovate to run every Tuesday after midnight to pick up new dependency updates that you can test over the following week before the next release.

**Caution**: You need to make sure you leave yourself and Renovate enough time in a week to actually get all your updating and merging done.
There are multiple reasons why Renovate may need to "recreate" PRs after you merge another:

1. Conflict with `package.json` (sometimes)
1. Conflict with lock files (often)
1. If you have configured Renovate or GitHub that PRs must always be kept up-to-date with the base branch

Any of the above reasons can lead to a Renovate branch being considered "stale" and then Renovate needs to rebase it off the base branch before you can test and merge again, and Renovate won't do this until it's back in schedule.

### Selective scheduling

Don't think that you need to apply blanket rules to scheduling.
Remember that Renovate's configuration is highly flexible so you can configure `automerge` anywhere from globally (entire repo) right down to a package/upgrade type level.
You could even configure a nonsensical rule like: "patch updates of `jquery` are for Mondays only".

Remember our example of grouping all `eslint` packages?
If you think about it, updates to `eslint` rules don't exactly need to be applied in real time!
You don't want to get too far behind, so how about we update `eslint` packages only once a month?

```json title="Update ESLint packages once a month"
{
  "packageRules": [
    {
      "matchPackagePatterns": ["eslint"],
      "groupName": "eslint",
      "schedule": ["on the first day of the month"]
    }
  ]
}
```

Or perhaps at least weekly:

```json title="Update ESLint packages weekly"
{
  "packageRules": [
    {
      "matchPackagePatterns": ["eslint"],
      "groupName": "eslint",
      "schedule": ["before 4am on monday"]
    }
  ]
}
```

If you're wondering what is supported and not, under the hood, the schedule is parsed using [@breejs/later](https://github.com/breejs/later) using the `later.parse.text(scheduleString)` API.
Read the parser documentation at [breejs.github.io/later/parsers.html#text](https://breejs.github.io/later/parsers.html#text).
Renovate does not support scheduled minutes or "at an exact time" granularity.
Granularity must be at least one hour.

## Automerging

Automerging is a Renovate feature that can save you a lot of time/noise directly, while also benefiting grouping and scheduling.
In short: it means that Renovate can merge PRs or even branches itself if they pass your tests.

We recommend that you enable automerge for any type of dependency update where you would select Merge anyway.
We all know that there are some types of updates that we (nearly) always verify manually before merging, and plenty of others that we don't bother looking at unless tests fail.
Every time you select Merge on a Renovate PR without manually testing it, you should consider if you can enable automerge and save yourself the time in future.

Automerge works particularly well for `devDependencies` and for production `dependencies` that have great test coverage.

For example, if you have `jest` or `mocha` as a dependency, and it has an upgrade with passing tests: automerge them!
If you have a linter like `eslint` or `tslint` and its update passes: automerge them!
If you have an API with 100% test coverage and `express` is updated: automerge it!

### Branch automerging

Those of you familiar with GitHub might note that even if you automerge PRs, you are still going to get notifications (noise) anyway - one when the PR is created and another when it is merged.
For this reason we recommend you consider setting `automergeType=branch` which will mean:

- Renovate first creates a branch and no PR
- If tests pass, Renovate pushes a commit directly to the base branch without PR
- If tests fail, Renovate raises a PR for you to review

The result is that passing updates are essentially "silent" - the only sign of them are the commits to your base branch.

### Automerging and scheduling

Automerging is particularly beneficial if you have configured a schedule, because Renovate on its own may be able to automerge the majority of your updates.
And this is especially so if your repository needs rebasing, e.g. because you use lock files. e.g. let's say you have dependencies `abc` and `xyz` with upgrades, and you use a `yarn.lock` file.

- At the start of the schedule, `Renovate` will create branches for `abc` and `xyz` upgrades, including `yarn.lock` updates
- After `abc` passes tests, `Renovate` will automerge it to your base branch
- The `xyz` branch probably now has `yarn.lock` conflicts
- Renovate will immediately check all other branches and rebase them
- The change to `xyz` branch will trigger another round of CI tests
- After the updated `xyz` branch passes, Renovate will automerge it too

This is a lot better than you waking up to two PRs and then having to deal with conflicts yourself after you merge the first one.

Remember our running `eslint` example?
Let's automerge it if all the linting updates pass:

```json title="Automerge ESLint packages"
{
  "packageRules": [
    {
      "matchPackagePatterns": ["eslint"],
      "groupName": "eslint",
      "schedule": ["before 4am on monday"],
      "automerge": true,
      "automergeType": "branch"
    }
  ]
}
```

Have you come up with a rule that would help others?
How about a PR to [our presets](https://github.com/renovatebot/renovate/tree/main/lib/config/presets/internal)?
For example the above rule could be named `":automergeEslintWeekly"` in `schedule.ts`.

## Lock file considerations

Using lock files greatly increases the chance that merging one PR will result in a second PR becoming conflicted with the base branch.
The table below highlights different noise reduction strategies and their effect on pull request and potential lock file conflicts:

| Action                               | Effect on pull requests  | Chance of lock file conflicts |
| ------------------------------------ | ------------------------ | ----------------------------- |
| Group dependencies together          | Decreases separate PRs   | Decreases                     |
| Automerge dependencies               | Decreases concurrent PRs | Decreases                     |
| Decrease scheduled time for Renovate | Increases concurrent PRs | Increases                     |

## The Future of Noise Reduction

First of all, if you ever have any ideas about how to make Renovate less noisy, please raise or comment on issues in the [main repository](https://github.com/renovatebot/renovate).
Our philosophy is:

1. Nearly everyone should use Renovate-like dependency update automation
1. Over time, you should "see" Renovate less and less

One of our hopes with preset configs is that a set of "sensible" configs can be maintained by the community that combine grouping, scheduling and automerging to reduce the amount of noise in repositories with little downside or increased risk.
Such lists could be maintained and used somewhat like Adblock lists - kept up to date by maintainers but for the majority of users they are simply trusted/automatic/invisible.
