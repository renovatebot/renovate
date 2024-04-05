# About minimal reproductions

We may ask you to create a "minimal reproduction" repository to help us fix bugs or work on a feature.

This document explains why we need a minimal reproduction, why we won't use your production repository to debug, and how to create a good minimal reproduction.

## Help yourself by creating a minimal reproduction

A minimal reproduction helps us to:

- Fix your bug faster
- Work on your feature request faster
- Confirm the cause of the behavior

It's fastest if you - as the bug reporter or feature requester - create the reproduction.

## How the Renovate developers use your minimal reproduction

The first benefit of a public reproduction is to prove that the problem is not caused by your environment or by a setting you left out of your description, thinking it wasn't relevant.
If there were any doubts about whether you'd found a genuine problem before, they are usually removed once a reproduction is made.

Next, when a reproduction has minimal config, it can often let us narrow down or even identify the root cause, suggest workarounds, etc.
This means we can often help you from code inspection alone.

Finally, by making the code/dependencies minimal, it usually makes the problem feasible to step through using a debugger if code inspection wasn't sufficient.
Production repositories or non-minimal reproductions are often very difficult to debug because break points get triggered dozens or hundreds or times.

## What is a minimal reproduction?

The basic idea of a minimal reproduction is to use the _least_ amount of both code and config to trigger missing or wrong behavior.
A minimal reproduction helps the developers see where the bug or missing feature is, and allows us to verify that the new code meets the requirements.

## Where to host the minimal reproduction

Unless it's impossible, use a public repository on GitHub.com to host your reproduction.
If the reproduction needs to be on another platform like GitLab or Bitbucket because it's related to functionality only on that platform, then that's okay.

## Creating a minimal reproduction

There are two ways to create a minimal reproduction:

- Start with an empty repository and copy files from your production repository
- Start with a fork of your production repository and remove files and config

General steps:

1. Create your minimal reproduction repository on GitHub, only use GitLab or Bitbucket if needed
1. Use the fewest number of repository files and dependencies
1. Reduce the Renovate config to a minimum
1. Remove private or secret information
1. Create a `readme.md` file that explains the current behavior and expected behavior
1. Set the repository visibility to `public`
1. Give us the link to the repository

### Why we won't use your production repository to debug

You may think:

> Why do you even need a minimal reproduction?
> I already have the reproduction on my production repository and it's public.
> Why not use that to debug?

A production repository usually has:

- many dependencies
- many custom rules in the Renovate configuration file
- many files that are not relevant

Having lots of "moving parts" makes debugging tricky, because debug break points can be triggered hundreds of times.

When you have lots of custom config for Renovate, it's hard to find the root cause of the behavior.
Bugs are often caused by multiple features interacting.
Reducing the config to a minimum helps us find out exactly which config elements are required to trigger the bug.

### "It's too much work to create a minimal reproduction"

If you don't create a minimal reproduction, the Renovate maintainers won't prioritize working on your issue.
Discussions without a reproduction will probably go stale unless you, or somebody else, creates a minimal reproduction.

### "I already described what you need in the issue"

Thank you for describing your issue in detail.
But we still need a minimal reproduction in a repository, and we'd like you to be the one to make sure it matches both your description as well as expected behavior.

### Forcing Renovate to create a lot of pending updates

Put an old version of a frequently updated dependency in your repository.
Set a high `minimumReleaseAge` for that dependency, for example:

```json
{
  "extends": ["config:best-practices"],
  "packageRules": [
    {
      "description": "Force lots of pending updates for the Prettier package",
      "matchPackageNames": ["prettier"],
      "minimumReleaseAge": "365 days"
    }
  ]
}
```

You'll get a lot of pending updates, which you can see on the Dependency Dashboard.
