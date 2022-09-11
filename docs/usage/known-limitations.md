# Known limitations

Learn about the limitations of Renovate bot.

## Introduction

Renovate, like any computer program has limitations.
Sometimes these are functionality limitations - perhaps something is impossible or too complex to do, or we simply haven't implemented it yet.
At other times it may be a "performance" limitation, because jobs neither start nor complete instantly, even if the user may start with that expectation.

This document tries to list out the most commonly seen limitations and describe whether they're permanent and if there's any plans to improving the situation.

## Time/schedule based limitations

When a user configures a schedule in their repo config, they may think that this schedule "controls" when Renovate runs.
In actuality, Renovate may be running frequently, but just skipping updates to the repo if the configured schedule is not met.
Additionally, the Renovate admin may have put the bot on its own schedule, or the job queue may be too long, so Renovate doesn't even get a chance to run on your repository during a certain scheduled time window.

For scheduled action to take place, both these need to happen:

- The bot needs to run against your repository
- The current time needs to fall within your repository's configured schedule

### GitHub hosted app scheduled jobs

On the GitHub hosted app Mend checks each active repository approximately every 3 hours, if no activity has been seen before then (merged PRs, etc).

For this reason, you should set your schedule window to at least three or four hours.
This makes it likely that Renovate bot checks your repository at least once during the schedule.

## Automerge limitations

- Renovate automerges at most one branch per run
- Renovate will only automerge a branch when it is up-to-date with the target branch
- Renovate may not be able to automerge as many branches as you expect, especially if your base branch is receiving regular commits at the same time

The limitation to only merge one branch per run is because Renovate's dependency and branch state is based on what was present in the base branch at the start of the run.
If a branch is merged into the base branch during Renovate's run - including by other users - it means that remaining Renovate branches may have Git conflicts.
It also means that Renovate's knowledge about dependencies in the base branch is now invalid and other branches may need changing as a result of the merge.

The limitation to only automerge branches which are up-to-date is a decision due to this example:

- Two dependencies are in use: `alice@1.0.0` and `bob@1.0.0`
- PRs exist for `alice@2.0.0` and `bob@2.0.0` and both pass tests
- The PR for `alice@2.0.0` is automerged
- The PR for `bob@2.0.0` remains open, does not have conflicts, and has all tests passing
- But `alice@2.0.0` and `bob@2.0.0` are incompatible so merging the PR without rebasing and retesting it first would result in a broken base branch
