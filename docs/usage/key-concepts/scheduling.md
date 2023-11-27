---
title: Renovate scheduling
description: Learn how to schedule when Renovate runs
---

This document describes Renovate's scheduling.

## Default behavior

By default, Renovate bot runs as often as its administrator has configured it to (e.g. hourly, daily, etc.).
The exact frequency at which Renovate can process individual repositories depends on the combination of how often it runs, how many repositories are installed, and whether there's a lot of work to be done in each repository (e.g. if a commonly used dependency has recently gotten a new update, which triggers a lot of PRs to be created).

By default, Renovate schedules use the UTC timezone.
You can override the default timezone by setting your own `timezone` config option.

## Global schedule vs specific schedule

When we talk about scheduling Renovate, there are 2 senses in which you can schedule Renovate:

- A global sense: when the bot is allowed to do work at all. This is determined by the bot admin using tools such as `cron`
- A specific sense: when Renovate is allowed to look for updates to a specific dependency

While as an end user you may think of scheduling in terms of when you allow it to raise updates, it's important to remember that such updates can only occur if the bot gets the opportunity to run within the schedule window you provide.

Because Renovate defaults to "always on" and "open PRs right away" it can be overwhelming your repository with notifications of new PRs.
To reduce overwhelm, we provide scheduling tools.

You may want to update certain repositories less often, or you may even want to use different schedules for specific packages.

## Scheduling use cases

Some common reasons to schedule when Renovate runs:

- Make Renovate run outside office hours, to free up continuous integration resources for developers during the day
- Get updates for certain packages on a regular interval instead of right away
- Reduce Renovate bot PR notifications during the day

## Customizing the schedule

You can customize when Renovate runs, by using the `timezone` and `schedule` configuration options.

At a high level you need to follow these steps:

1. Tell Renovate what `timezone` you want to use
1. Learn about the scheduling syntax
1. Optional: configure an "in repository schedule"
1. Optional: create packageRules with a custom `schedule` for specific packages

### Setting your timezone

By default, Renovate schedules use the UTC timezone.
If you want Renovate to use your local time, use the `timezone` configuration option.
The timezone must be a valid [IANA time zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

```json title="Setting a specific timezone in your local config file"
{
  "timezone": "America/Los_Angeles"
}
```

Also read the [`timezone` config option docs](../configuration-options.md#timezone).

### Scheduling syntax

After you've set your local timezone, you can define "days of the week" or "hours of the day" in which Renovate is allowed to make changes.

```title="Examples of the kind of schedules you can create"
every weekend
before 5:00am
[after 10pm, before 5:00am]
[after 10pm every weekday, before 5am every weekday]
on friday and saturday
```

<!-- prettier-ignore -->
!!! warning
    Renovate does not support scheduled minutes or "at an exact time" granularity.
    Granularity must be at least one hour.

Renovate uses the [@breejs/later](https://github.com/breejs/later) library to parse the text, so Renovate is limited to that library's syntax support.
Read the parser documentation at [breejs.github.io/later/parsers.html#text](https://breejs.github.io/later/parsers.html#text) for more details.
The _@breejs/later_ library also handles the concepts of "days", time_before", and "time_after".

### In repository schedule configuration

Reminder: the times when the Renovate process runs are controlled by the bot admin using tools such as `cron`.
If you use the Mend Renovate App, the default is that Renovate will always be allowed to run.

Be sure to schedule enough time for Renovate to process your repository.
Do not set schedules like "Run Renovate for an hour each Sunday" as you _will_ run into problems.

Some config examples:

```json title="Renovate should run each day before 4 am"
{
  "schedule": ["before 4am"]
}
```

```json title="Renovate should run outside of common office hours"
{
  "schedule": [
    "after 10pm every weekday",
    "before 5am every weekday",
    "every weekend"
  ]
}
```

#### Schedule presets

Renovate has preset schedules that you might want to use, go to [Schedule Presets](https://docs.renovatebot.com/presets-schedule/) to see them.

These preset schedules only affect when Renovate bot checks for updates, and do not affect any specific dependencies/packages.

### Schedule when to update specific dependencies

The scheduling feature can be very useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

```json title="Restrict aws-sdk to weekly updates"
{
  "packageRules": [
    {
      "matchPackageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
}
```

The "schedule" property must _always_ be defined in an array, even if you only set a single schedule.
Multiple entries in the array means "or".

Read the [schedule config option](../configuration-options.md#schedule) documentation to learn more.
