# Bug report handling

## Start with a Discussion

We use GitHub Discussions as a triaging stage for bug reports.
Users should [create a new Request Help discussion](https://github.com/renovatebot/renovate/discussions/new?category=request-help) and choose from the options there.

We often need more information to resolve your bug report.
Maintainers may ask for such information directly, or use automated label comments, or both.
Maintainers may close bug reports that lack the extra information, for example when keeping the Discussion open does not help other users anymore.

We only create issues in this repository when we:

- consider them to be actionable
- are in a state where someone could work on it

We often need a minimal reproduction or logs, or even _both_, to pinpoint the exact problem.
Because we need enough information for a actionable bug report, we may close Discussions that lack the needed info, even if it's highly likely the behavior is buggy.

We have found that keeping Issues around that are not actionable just leads to them getting stale, and then closed.
The Issues list is meant as a list of actionable things for a contributor or maintainer to pick up eventually.

## Discussion Resolution

Bug reports are resolved in one of three ways:

1. Confirmed as a bug. The Discussion will be converted to an Issue, and then closed. Any future comments go to the Issue and _not_ the Discussion.
1. Closed as "behaving as designed" with no further action. The Discussion will be closed with a relevant note.
1. Rejected as not a _bug_, but accepted as a _feature request_. The Discussion will be closed with a note suggesting that the poster create a new "Suggest an Idea" Discussion instead, which can then be converted to an Issue once actionable.

## FAQ

### What's your definition of bug?

Bugs are behavior in Renovate which is _not_ as intended or documented.
Missing functionality or partial support is not automatically a bug.
For example, we're probably missing at least one feature from each package manager that Renovate supports.
If we labeled all those missing features as bugs, we lose sight of real bugs.

### Why can't I create Bug Issues directly?

It is really hard for users to decide if something is a bug.
Only a fraction of the incoming bug reports are for things we consider proper bugs.

A while ago, users were allowed to create Bug Issues.
We ended up with many "bug, but not really" type issues, that polluted the repository.
Those issues made it tricky for maintainers and users to see what's really going on in the repository.
We have since closed many old user-created bug Issues, and now only allow maintainers to create bug Issues.
This way we do not end up in the same situation again.

### What if I disagree with your definition of bug?

We are not interested in debating you, we prefer to spend our time helping users solve their problems.
We are open to improve our approach to bugs, or this document, in good spirit.
Please do _not_ post comments like these:

- "How dare you block users from creating Issues?!"
- "If the behavior was unexpected to me then that means it's a bug."

Users who want to make our life difficult as maintainers will be blocked.
Read our [Code of Conduct](https://github.com/renovatebot/renovate/blob/main/CODE_OF_CONDUCT.md) to learn more.

### Why do you close Bug discussions?

It's important to move relevant reports to the next step of an Issue, and focus our attention there.
Bug reports that are not (going to be) an Issue, are marked as "not a bug".
This helps future users who browse or search the repository for similar terms, as they will not see any invalid Bug reports.

If you are not sure if you have an _actual_ bug to report, please use the "Request Help" Discussion category.

### When will you fix my bug?

There are no Service Level Agreements (SLAs) in Open Source.
This means we are not required to respond to, or fix your problem within a certain time.

If you are a paying Mend.io customer, please tell your support or customer contact that this bug is important to you.

Please read our [Code of Conduct, how we prioritize work](https://github.com/renovatebot/renovate/blob/main/CODE_OF_CONDUCT.md#how-we-prioritize-work) to learn more.
