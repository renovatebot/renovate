---
title: Automerge configuration/troubleshooting
description: Learn all about Renovate's automerge functionality here
---

# Introduction

Automerging is a Renovate feature that can save you a lot of time/noise directly, while also benefiting grouping and scheduling.
In short: it means that Renovate can merge PRs or even branches itself if they pass your tests.

It is recommended that you enable automerge for any types of dependency updates where you would just click Merge anyway.
We all know that there are some types of updates that we (nearly) always verify manually before merging, and plenty of others that we don't bother looking at unless tests fail.
Every time you click Merge on a Renovate PR without manually testing it, you should consider if you can enable automerge and save yourself the time in future.

Automerge works particularly well for `devDependencies` and for production `dependencies` that have great test coverage.

For example, if you have `jest` or `mocha` as a dependency, and it has an upgrade with passing tests.. automerge them!
If you have a linter like `eslint` or `tslint` and its update passes.. automerge them!
If you have an API with 100% test coverage and `express` is updated.. automerge it!

## Full configuration examples

I think the endgame here should be:

- Each example use case is fully realised, and should be copy/pasteable and work.
- The example should explain the reasoning/thinking behind each setting.
- The example should have links to each setting, so that the docs can be consulted.

### Automerge lockfile dependencies

I think this is a good usecase to cover, it's something that a lot of people will probably want.

### Automerge Prettier or ESLint dependency

This is probably a good one to cover as well.
I think many users just click "merge" on those types of updates as well.

### Automerge patch/minor update

Automerge patch level updates is probably good to cover as well.
Patch level `minor` updates shouldn't have breaking changes (if they follow SemVer that is...), so that makes them a good case to cover as well.

### Automerging and scheduling

Automerging is particularly beneficial if you have configured a schedule, because Renovate on its own may be able to automerge the majority of your updates.
And this is especially so if your repository needs rebasing, e.g. because you use lock files. e.g. let's say you have dependencies `abc` and `xyz` with upgrades, and you use a `yarn.lock` file.

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

Have you come up with a rule that you think others would benefit from?
How about a PR back to [renovate-config](https://github.com/singapore/renovate-config) with the above rule named `":automergeEslintWeekly"` ?

## Frequent problems and how to resolve them

### Automerge config not correct to begin with

What are the most common mistakes people make when doing the initial configuring?

### Branch vs PR

Those of you familiar with GitHub might note that even if you automerge PRs, you are still going to get notifications (noise) anyway - one when the PR is created and another when it is merged.
For this reason we recommend you consider setting `automergeType=branch` which will mean:

- Renovate first creates a branch and no PR
- If tests pass, Renovate pushes a commit directly to `master` without PR
- If tests fail, Renovate raises a PR for you to review

The result is that passing updates are essentially "silent" - the only sign of them are the commits to your `master` branch.

### Absence of tests

If you don't have any tests at all, tell Renovate to ignore the tests with the <LINK TO OPTION DOCS GOES HERE>.

### Branch protection rules

What branch protection rules specifically are causing problems?

### Required reviews

I think we want users to use the Renovate-approve and renovate-approve-2 bots?
Probably should add links to those on the GitHub marketplace?
Do we have bots for other platforms or only for GitHub?

### Codeowners

What should a user do when a codeowners file blocks renovate bot?

### Assignees and reviewers (defuault empty when merging)

I'm not really sure what the problem with this is right now.
