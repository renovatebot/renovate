---
title: Renovate scheduling
description: Learn how to schedule when Renovate runs
---

This document describes Renovate's scheduling.

## Default behavior

On the backend side, Renovate bot runs as often as its administrator has configured Renovate to run.
For example, the administrator configure Renovate to begin its runs hourly, daily, or outside office hours only.
How often Renovate runs per-repository subsequently depends on how many repositories there are to check, and how many updates are pending for each repository at the time.
If the backend configuration for Renovate means it runs scheduled jobs per-repo approximately every X hours, it is not possible for _repository configuration_ to reduce that to less than X, or to force Renovate to run at exact times on specific repos.

### Default timezone

By default, Renovate schedules use the UTC timezone.
But you can set your own timezone with the `timezone` config option.

### How long Renovate takes to run when scheduled

How often Renovate processes individual repositories depends on:

- How often Renovate runs
- How many repositories Renovate is onboarded to, in your organization or user account
- How much work Renovate must do in each repository

The table below shows how the number of dependencies and repositories affect Renovate run times.

| Dependencies to update | Repositories with the dependencies | Run time  |
| ---------------------- | ---------------------------------- | --------- |
| 1                      | 1                                  | Very fast |
| 1                      | 10                                 | Fast      |
| 1                      | 100                                | Slow      |
| 50                     | 1                                  | Slow      |
| 100                    | 100                                | Very slow |

## Global schedule vs specific schedule

At a high level, you have two ways to schedule Renovate, a "global way" and a "specific way":

| Way to schedule Renovate | What this does                                                                                           | Notes                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Global                   | Decides when Renovate runs.                                                                              | This schedule is usually controlled by your organization's bot administor. For the Mend Renovate app, Mend decides when Renovate runs. |
| Specific                 | When Renovate runs it checks the schedule to see if it should look for updates to a specific dependency. | Usually set in the `renovate.json` config file, or similar config file.                                                                |

Renovate can only update a dependency if _both_ of these conditions are true:

- The Renovate program is running (on your hardware, or on Mend's hardware)
- The schedule set in the Renovate config file(s) allows Renovate to look for updates for that dependency

### Managing update frequency

Because Renovate defaults to "always on" and "open PRs right away" it can overwhelm you with "new PR" notifications.
Use the schedule to control when Renovate looks for updates, for example:

- Limit Renovate to check for updates in your repository to once a week. (In your repository's Renovate config file)
- Set update schedules for a package, or group of packages

## Scheduling use cases

You can use the scheduling tools to:

- Run Renovate outside office hours, to free up continous integration resources for your developers
- Get updates for certain packages on a regular interval, instead of right away
- Reduce Renovate bot PR notifications during the day

## Customizing the schedule

Use the `timezone` and `schedule` configuration options to control when Renovate runs.

At a high level you need to follow these steps:

1. Tell Renovate what `timezone` you want to use
1. Learn about the scheduling syntax
1. _Optional_ set an "in-repository schedule"
1. _Optional_ set packageRules with a custom `schedule` for a package, or group of packages

### Setting your timezone

By default, Renovate's schedules use the UTC timezone.

If you want Renovate to use your local time, use the `timezone` configuration option.
You must use a valid [IANA time zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)!

```json title="Setting a specific timezone in your local config file"
{
  "timezone": "America/Los_Angeles"
}
```

Also read the [`timezone` config option docs](../configuration-options.md#timezone).

### Scheduling syntax

After you've set your local timezone, you can set "days of the week" or "hours of the day" in which Renovate is allowed to make changes.

#### Recommended cron syntax

We recommend you use the `cron` syntax in your Renovate schedules.

| Description                                  | Cron syntax           |
| -------------------------------------------- | --------------------- |
| every weekend                                | `* * * * 0,6`         |
| before 5:00am                                | `* 0-4 * * *`         |
| after 10pm and before 5am every weekday      | `* 22-23,0-4 * * 1-5` |
| on friday and saturday                       | `* * * * 5,6`         |
| every 3 months on the first day of the month | `* * 1 */3 *`         |

<!-- prettier-ignore -->
!!! note
    For Cron schedules, you _must_ use the `*` wildcard for the minutes value, as Renovate doesn't support minute granularity.
    And the cron schedule must have five parts.

#### Deprecated breejs/later syntax

This section explains the deprecated `@breejs/later` syntax.
We plan to remove the `@breejs/later` library in a future major Renovate release if we can find a way to migrate all valid schedules to cron syntax.
Due to this upcoming change, we strongly recommend you use `cron` schedules.

Renovate uses the [`@breejs/later` library](https://github.com/breejs/later) to parse the text.
For Renovate to understand the schedule, you must use valid `@breejs/later` syntax.
Read the [@breejs/later parses docs at breejs.github.io](https://breejs.github.io/later/parsers.html#text) for more details.
The `@breejs/later` library also controls the interpretation of "days", time_before", and "time_after" keywords.

| Valid, but deprecated later syntax           | Cron syntax           |
| -------------------------------------------- | --------------------- |
| every weekend                                | `* * * * 0,6`         |
| before 5:00am                                | `* 0-4 * * *`         |
| after 10pm and before 5am every weekday      | `* 22-23,0-4 * * 1-5` |
| on friday and saturday                       | `* * * * 5,6`         |
| every 3 months on the first day of the month | `* * 1 */3 *`         |

<!-- prettier-ignore -->
!!! warning
    Renovate does _not_ support scheduled minutes or "at an exact time" granularity.
    Granularity must be at least one hour.

### In-repository schedule configuration

Important: _when_ the Renovate process runs is usually controlled by the bot admin, using tools such as `cron`.
For the Mend Renovate App, the Mend maintainers control when the Renovate process runs, usually hourly.

If you control the hardware that Renovate runs on, we recommend you:

- Schedule enough time on the hardware for Renovate to process your repositories
- Avoid schedules like "Run Renovate for an hour each Sunday" as you _will_ run into problems

Some config examples:

```json title="Renovate should run each day before 4 am"
{
  "description": "Schedule daily before 4 AM",
  "schedule": ["* 0-3 * * *"]
}
```

```json title="Renovate should run outside of common office hours"
{
  "description": "Schedule during typical non-office hours on weekdays (i.e., 10 PM - 5 AM) and anytime on weekends",
  "schedule": ["* 0-4,22-23 * * 1-5", "* * * * 0,6"]
}
```

#### Schedule presets

Renovate has built-in presets for common schedules, like "once a week", "outside office hours" and so on.
Before you create your own custom schedule, check if the [Schedule Presets](../presets-schedule.md) has what you need.

The preset schedules only decide when Renovate looks for updates, and do _not_ affect any specific dependencies/packages.

### Schedule when to update specific dependencies

With Renovate's scheduling features you can "limit the noise" from frequently updating dependencies, like the AWS SDK:

```json title="Restrict AWS SDK to weekly updates"
{
  "packageRules": [
    {
      "description": "Schedule AWS SDK updates on Sunday nights (9 PM - 12 AM)",
      "matchPackageNames": ["@aws-sdk/*"],
      "schedule": ["* 21-23 * * 0"]
    }
  ]
}
```

Important tips for the `"schedule"` property:

- Always use the array syntax `[]`, even if you only set a single schedule
- Separate entries with a comma, like this: `["cron for schedule 1", "cron for schedule 2"]`
- Multiple entries in the `"schedule"` array are interpreted with the Boolean OR logic

Read the [schedule config option](../configuration-options.md#schedule) documentation to learn more.
