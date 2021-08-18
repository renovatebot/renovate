---
title: Renovate scheduling
description: Learn how to schedule when Renovate bot runs
---

This document describes Renovate bot's scheduling.

## Default behavior

By default Renovate runs as often as its administrator has configured it to (e.g. hourly, daily, etc).
You may want to update certain repositories less often.
Or you may even want to use different schedules for specific packages.

To control the days of the week or times of day that Renovate updates packages, use the `timezone` and `schedule` configuration options.
By default, Renovate schedules use the UTC timezone, but you can override this in the global config.

## Scheduling use cases

By scheduling when Renovate bot runs you can:

- Make Renovate run outside of office hours, to free up CI resources for developers
- Get updates for certain packages on a regular interval instead of right away
- Reduce notifications during the day

### Setting the timezone

By default Renovate schedules use the UTC timezone.
If you want Renovate to use your local time, use the `timezone` configuration option.

Read our docs on the [timezone](https://docs.renovatebot.com/configuration-options/#timezone) configuration option.

## Schedule presets

Renovate has preset schedules that you might like to use, go to [Schedule Presets](https://docs.renovatebot.com/presets-schedule/) to see them.

## Bree.js later support

Renovate bot uses a fork of Later to handle everything to do with time.

## Text to incorporate into this document in a better way

Renovate itself will run as often as its administrator has configured it (e.g. hourly, daily, etc).
You may want to update certain repositories less often.
Or you may even want to use different schedules for specific packages.

To control the days of the week or times of day that Renovate updates packages, use the `timezone` and `schedule` configuration options.
By default, Renovate schedules use the UTC timezone, but you can override this in the global config.

You can set a specific time zone in your local config file as well:

```json
{
  "timezone": "America/Los_Angeles"
}
```

The timezone must be a valid [IANA time zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

With the timezone set, you can define days of week or hours of the day in which Renovate will make changes.
Renovate uses the [@breejs/later](https://github.com/breejs/later) library to parse the text.
Read the parser documentation at [breejs.github.io/later/parsers.html#text](https://breejs.github.io/later/parsers.html#text).
The _@breejs/later_ library also handles the concepts of "days", time_before", and "time_after".
Renovate does not support scheduled minutes or "at an exact time" granularity.

Examples of the kind of schedules you can create:

```
every weekend
before 5:00am
[after 10pm, before 5:00am]
[after 10pm every weekday, before 5am every weekday]
on friday and saturday
```

The scheduling feature can be very useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

To restrict `aws-sdk` to weekly updates, you could add this package rule:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
}
```

The "schedule" propery must always be defined in an array, even if you only set a single schedule.
Multiple entries in the array means "or".
