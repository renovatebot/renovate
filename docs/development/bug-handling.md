# Bug report handling

## Start with a Discussion

We use GitHub Discussions as a triaging stage for bug reports.
Users should [create a new Request Help discussion](https://github.com/renovatebot/renovate/discussions/new?category=request-help) and choose from the options there.

Bug reports often require additional information to resolve, so maintainers might ask directly for such information, or use automated label comments, or both.
Bug reports which are missing the required additional information may be closed by maintainers if they feel that the Discussion as it exists is not beneficial to other users to leave open.

We only create issues in this repository when we consider them to be actionable and work is ready to begin.
Even if it seems highly likely that behavior is buggy, if there's no way to reproduce it or logs which can pinpoint it, then we usually won't create an Issue because it will just grow stale.

## Discussion Resolution

Bug reports can be resolved in one of three ways:

1. Confirmed as a bug. The Discussion will be converted to an issue an issue and then closed, so that any future comments go to the Issue and not the Discussion.
2. Rejected as "behaving as designed" with no further action needed. The Discussion will be closed with a relevant note.
3. Rejected as not a bug, but accepted as a feature request. The Discussion will be closed with a note suggesting that the poster create a new "Suggest an Idea" Discussion instead, which can then be converted to an Issue once actionable.

## FAQ

### What's your definition of bug?

A bug is classified as behavior in Renovate which is not as intended or documented.
Missing functionality or incomplete support is not automatically a bug.
For example, there's probably at least one feature of every package manager which is missing, and if we classified them all as "bugs" then the meaning of real bugs would be lost.

### Why can't I create Bug Issues directly?

Users have proven themselves to be poor judges of when something is a bug or not. Only a fraction of bug reports are actually bugs, and the remainder once used to pollute the repo issues, making it worse for maintainers and users alike to know what's "really" going on.

### What if I disagree with your definition of bug?

We're not interesting in debating you - we prefer to spend our time helping users solve their problems.
We don't mind evolving our approach or improvements to this document, but if you wholesale disagree with us on this (e.g. "how dare you block users from creating issues" or "if the behavior was unexpected to me then that means it's a bug") then you're better to keep the opinion to yourself or find a different project.
Users who want to make our life difficult as maintainers will be [blocked](https://github.com/renovatebot/renovate/blob/main/CODE_OF_CONDUCT.md).

### Why do you close Bug discussions?

It's important to move relevant reports to the next step of an Issue, and focus attention there.
For those which aren't eligible to become an issue, it's important to mark them as "not a bug" for the benefit of future users browsing or searching the repo for similar terms, to reduce the chance of them getting confused by invalid Bug reports.

No one forces you to "report a bug", just like nobody forces you to "report a crime" to the police.
If you're unsure, ask a question, instead of creating an accusation.

### When will you fix my bug?

There are no SLAs in Open Source.
See our [Code of Conduct section on how we prioritize work](https://github.com/renovatebot/renovate/blob/main/CODE_OF_CONDUCT.md#how-we-prioritize-work).
