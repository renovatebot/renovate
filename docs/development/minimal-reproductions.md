# About minimal reproductions

We may ask you to create a "minimal reproduction" repository.

## What is a minimal reproduction?

A minimal reproduction is a repository with the _least_ amount of code and config that still triggers missing or wrong behavior.

### Example of a perfect reproduction

The [`renovate-reproductions/12260` repository](https://github.com/renovate-reproductions/12260) shows a perfect reproduction, because it:

- Only has the files/config needed to trigger the bug
- Explains the current behavior and the expected behavior in the `readme.md`
- Links to the Renovate Issue, or Discussion in the `readme.md`
- Uses headings to organize information

## Creating a minimal reproduction

Please read this section in full _before_ starting on your minimal reproduction.

### Ways to create a minimal reproduction

There are two methods to create a reproduction, see the table for a comparison.

| Start point                                                                                       | Method                  | Benefits                          | Drawbacks                                  |
| :------------------------------------------------------------------------------------------------ | :---------------------- | :-------------------------------- | :----------------------------------------- |
| [our minimal reproduction template](https://github.com/renovatebot/minimal-reproduction-template) | Copy files and config   | Minimal start point               | Crafting the bad config/setup from scratch |
| Fork production repo                                                                              | Remove files and config | Start with known bad config/setup | May need to edit/delete many files         |

Either method will work.
We recommend you start from [our minimal reproduction template](https://github.com/renovatebot/minimal-reproduction-template).

### General steps

_Always_ follow these steps:

1. Put your minimal reproduction repository on GitHub, only use GitLab or Bitbucket if needed
1. Use the fewest number of repository files and dependencies
1. Reduce your Renovate config to a minimum
1. Remove private or secret information
1. Create a `readme.md` file (or edit the template `readme.md`) and:
   - Explain the _Current behavior_ and _Expected behavior_
   - Link to the Renovate Issue or Discussion
   - Use headings to organize the information
1. Set the repository visibility to `public`
1. Give us the link to the repository

### Host your reproduction on GitHub.com, if possible

Please put your reproduction in a _public_ repository on GitHub.com, if possible.

You may put the reproduction on another platform like GitLab or Bitbucket, _if_ the reproduction needs features/behavior of that platform.

### Tips

You can find tips for specific situations here.

#### Forcing Renovate to create a lot of pending updates

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

## How we use your minimal reproduction

A minimal reproduction helps the Renovate developers:

- confirm the problem is with Renovate, and _not_ with your environment, or your configuration settings
- see where the bug or missing feature is
- verify that the new code solves the problem, or correctly adds a feature
- identify the root cause, or narrow down the possible causes
- suggest workarounds for the problem
- find where to look in our code to help you
- step through the code with a debugger

## Why we will not use your production repository to debug

You may think:

> Why do you even need a minimal reproduction?
> I already have the reproduction on my production repository and it's public.
> Why not use that to debug?

This is because a production repository often has:

- many dependencies
- many custom rules in the Renovate configuration file
- many files that are not relevant

Lots of "moving parts" makes it hard to debug, as debug break points can trigger hundreds of times.

When you have lots of custom config for Renovate, it's hard for us to find the root cause of the behavior.
Bugs are often caused by multiple features interacting.
Reducing the config to a minimum helps us find exactly which config elements are needed to trigger the bug.

## Response to common objections

Here are our responses to some common objections from users about creating a minimal reproduction.

### "It's too much work to create a minimal reproduction"

We know that it can be hard to create a minimal reproduction.

The Renovate maintainers prioritize issues that have a minimal reproduction repository.
If you do not create a minimal reproduction, the Renovate maintainers will probably work on other issues first.

Discussions without a reproduction usually go stale.

### "I already described what you need in the issue"

Thank you for describing your issue in detail.
But we still need a minimal reproduction.
Make sure your minimal reproduction matches your description and your expected behavior.
