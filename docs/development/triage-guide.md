# Triage guide

## What is triage?

Triage is basically filtering the issues/discussions, and categorizing them with the proper labels.

TODO: Question, do we want to use `priority-5-triage` to mean "figure out if issue is valid at all", or just "we don't yet know what the priority should be"?

TODO: I've been thinking about adding a `waiting-for-response` type label, that means that we're waiting on somebody to respond to us. If it takes way too long to respond, we can ping again or close the issue. Gatsby has a `status: needs more info` label when they need more information from the issue poster. We might benefit from such a label too.

TODO: Gatsby has a `status: needs core review` to get the core maintainers attention. This could be a less noisy way to grab your attention in case I cannot triage the issue myself.

TODO: Maybe add `status: needs core review` to all feature requests, I don't feel qualified to pick a priority level on incoming feature requests, so they are stuck on `priority-5-triage` until a member of the core Renovate team can take a look. Might as well label it `status: needs core review` so that the core team can filter new/old stuff that needs their attention.

TODO: Gatsby has the concept of first-touch maintenance. They assign core members of the team to do this first-touch triage on a regular basis. Not sure if this would work for Renovate, as the core team is not that big, and it would add overhead/management.

## Triaging bug reports workflow

Take the following steps on an incoming bug report:

1. Determine if this is a valid issue at all, close and optionally delete obvious spam.
1. If poster is asking a configuration question, or has not made a convincing case that it's really a bug, then convert to discussion, add either a response or at least a note that it's been converted, and issue can be deleted by an admin.
1. Check what version of Renovate is used, if not on current major version then apply the `retry latest version` label.
1. Determine if this is a duplicate of a open issue, if duplicate: link to earlier issue, apply `duplicate` label and close the issue.
1. Check if the _relevant_ logs are provided. If not apply the `logs:problem` label.
1. If it's an easy issue for somebody new to Renovate to help us with apply the `good first issue` label.
1. If the issue is hard to fix without outside help apply the `help wanted` label.

## Triaging feature requests workflow

Take the following steps on an incoming feature request:

1. Determine if this is a valid feature request at all, close obvious spam.
1. If poster is asking a configuration question, convert to discussion.
1. Determine if this is a duplicate of a open issue, if duplicate: link to earlier issue, apply `duplicate` label and close the issue.
1. Make a best-effort judgement if this is a reasonable feature to put into Renovate. If in doubt, let the core maintainers decide.
1. Make a initial judgement of the priority, and add the appropriate priority label.
1. If it's an easy feature for somebody new to Renovate to help us with apply the `good first issue` label.
1. If the feature is hard to start work on without outside help apply the `help wanted` label.

## What a triagist is allowed to do

If you've been given triage rights, you are allowed to do the following things:

- Apply labels to issues
- Close, reopen, and assign all issues and pull requests
- Mark duplicate issues and pull requests
- Request pull request reviews
- Lock and unlock discussions
- Individually convert issues to discussions

**Note:** We don't use milestones or project boards.

## Guidelines for triage workflow

The following are guidelines as we cannot cover all situations.
Use common sense, and just do your best, and you'll do all right.
Don't be afraid to ask for help.

### Apply labels to issues

All issues should have labels attached to them.
Read the [issue-labeling guide](https://github.com/renovatebot/renovate/blob/main/docs/development/issue-labeling.md) to get all the necessary info.

In general try to make a good-faith effort to label issues correctly.

### Closing issues

You can close an issue yourself if it's:

- Spam
- Obviously fixed

For really old issues, it's probably a good idea to ask the maintainers to decide if they want to keep or close the issue.

### Closing pull requests

It's not very often that you'll need to close a PR, but you can certainly do it in case of spam or malicious content in the PR diff.

### Reopen issues

Sometimes a bug is fixed with a PR that links to an issue.
When the PR is merged, the issue is automatically closed.
Sometimes the bug was not really fixed, and someone says: "Hey this is still broken for me."
In that case, re-open the issue only if it's definitely the same problem (users often associate different problems together incorrectly).
Otherwise, ask the user to open a new issue if it seems like it is different.

### Assign issues

You can assign an issue to yourself, so that others know you're going to work on the issue.
GitHub allows issues to be assigned to any project collaborator or to any non-collaborator who has created or commented on the issue, so you can also assign in either of those cases if it makes sense.

### Mark duplicate issues and pull requests

If you see an issue that's an obvious duplicate:

1. Attach a `duplicate` label
1. Use the "Duplicate of" functionality [GitHub docs, about duplicate issues and pull requests](https://docs.github.com/en/free-pro-team@latest/github/managing-your-work-on-github/about-duplicate-issues-and-pull-requests)
1. Close the issue

Follow the same workflow to mark duplicate PRs.

### Request PR reviews

You can request a review from one of the maintainers, in case this is needed to get the PR review process rolling.

### Lock and unlock discussions

Sometimes a discussion can go sour, like when people call each other names, or post spam, or veer off-topic.
In those cases you can lock the discussion to prevent further escalation.

### Individually convert issues to discussions

Sometimes an issue that's raised at the Renovate repository is not really a bug or a feature request.
This happens most often because a user files a bug for things that are really a mistake in the Renovate configuration.
Those "configuration help" issues are then moved to the discussions board for further help.

### Moving issues from `status:requirements` to `status:ready`

One of the most important non-code contributions people can do is help features and fixes go from `status:requirements` to `status:ready`.
We use the label `status:requirements` to mean "more information or research is needed before someone could start coding this".

It can sometimes be an oversight of the maintainers, but more often it's because there are requirements or edge cases to consider and the user hasn't got an opinion or time to think about them and contribute enough.
Sometimes it can be because there's a need for some research and "design" decisions to be made, which may require maintainers to do, but it's not high enough priority to justify the time yet.

In a way `status:requirements` means "someone's going to need to put more thought into this before it can move forward to development".
It can also mean "don't start this now because you might do something which can't be accepted into the code base".
