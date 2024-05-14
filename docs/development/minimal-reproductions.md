# About minimal reproductions

We may ask you to create a "minimal reproduction" repository to help us fix bugs or work on a feature.

This document explains:

- why we need a minimal reproduction
- why we will not use your production repository to debug
- how to create a good minimal reproduction

## Help yourself by creating a minimal reproduction

A minimal reproduction helps us to:

- Fix your bug faster
- Work on your feature request faster
- Confirm the cause of the behavior

It's fastest if you - as the bug reporter or feature requester - create the reproduction.

## How the Renovate developers use your minimal reproduction

A reproduction confirms the problem is with Renovate, and _not_ with your environment, or your configuration settings.
A reproduction also helps us see where the bug or missing feature is, and to verify that the new code meets the requirements.

When a reproduction has minimal config, we can oftern narrow down, or identify the root cause.
This helps us suggest workarounds.
Often we can help you from code inspection alone.

Finally, with minimal code and dependencies, we can step through with a debugger.
This helps when looking at the code is not enough to find the problem.
Production repositories, or non-minimal reproductions, are hard to debug as break points get triggered often.

## What is a minimal reproduction?

A minimal reproduction should have the _least_ amount of both code and config to trigger missing or wrong behavior.

## Where to host the minimal reproduction

Please put your reproduction in a public repository on GitHub.com, if possible.

You may put the reproduction on another platform like GitLab or Bitbucket, _if_ the reproduction needs features/behavior of that platform.

## Creating a minimal reproduction

There are two ways to create a minimal reproduction:

- Start with an empty repository and _copy_ files from your production repository
- Start with a fork of your production repository and _remove_ files and config

General steps:

1. Put your minimal reproduction repository on GitHub, only use GitLab or Bitbucket if needed
1. Use the fewest number of repository files and dependencies
1. Reduce your Renovate config to a minimum
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

Having lots of "moving parts" makes it hard to debug, as debug break points can trigger hundreds of times.

When you have lots of custom config for Renovate, it's hard for us to find the root cause of the behavior.
Bugs are often caused by multiple features interacting.
Reducing the config to a minimum helps us find exactly which config elements are needed to trigger the bug.

### "It's too much work to create a minimal reproduction"

If you do not create a minimal reproduction, the Renovate maintainers will not prioritize working on your issue.
Discussions without a reproduction will probably go stale unless you, or somebody else, creates a minimal reproduction.

### "I already described what you need in the issue"

Thank you for describing your issue in detail.
But we still need a minimal reproduction in a repository.
We'd like you to make sure it matches both your description as well as expected behavior.

### Forcing Renovate to create a lot of pending updates

Put an old version of a frequently updated dependency in your repository.
Then set a high `minimumReleaseAge` for that dependency, for example:

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
