# Triage guide

## What is triage?

Triage means filtering the issues/discussions, and categorizing them with the proper labels.

## Triage workflows

The general triage workflow is similar for bug reports and feature requests, but there are some small differences which are documented below.

### Triaging bug reports workflow

Take the following steps on an incoming bug report:

1. Determine if this is a valid bug report at all, close and optionally delete obvious spam.
1. If poster is asking a configuration question, or has not made a convincing case that it's really a bug, then convert to a "Ask a question" discussion, add either a response or at least a note that it's been converted.
1. Determine if this is a duplicate of an open issue/discussion, if duplicate: link to earlier issue/discussion, apply `duplicate` label and close the issue/discussion.
1. Check what version of Renovate is used, if not on current major version: apply the `auto:retry-latest` label. This makes a bot comment to try again with a newer version of Renovate.
1. Check if the _relevant_ logs are provided. If not apply the `auto:logs` label.

### Triaging feature requests workflow

Take the following steps on an incoming feature request:

1. Determine if this is a valid feature request at all, close and optionally delete obvious spam.
1. If poster is asking a configuration question, or has not made a convincing case that it's really a feature request, then convert to a "Ask a question" discussion, add either a response or at least a note that it's been converted.
1. Determine if this is a duplicate of an open issue, if duplicate: link to earlier issue/discussion, apply `duplicate` label and close the issue/discussion.
1. Check what version of Renovate is used, if not on current major version: apply the `auto:retry-latest` label. This makes a bot comment to try again with a newer version of Renovate.
1. Make a best-effort judgement if this is a reasonable feature to put into Renovate. If in doubt, let the core maintainers decide.

## Creating new issues from discussions

We want _actionable_ issues, so only _maintainers_ (and other approved users) may create them.
In short: users create discussions, and when it's clear what we need to do, the maintainers create the issue.

### Special labels for issues

- If it's an easy issue for somebody new to Renovate to help us with: apply the `good first issue` label
- If we need outside help on the issue, apply the `help wanted` label

## What a triagist is allowed to do

If you've been given triage rights, you are allowed to do the following things:

- Apply labels to issues/discussions
- Close, reopen, and assign all issues and pull requests
- Mark duplicate issues and pull requests
- Request pull request reviews
- Lock and unlock discussions
- Individually convert issues to discussions (do _not_ bulk convert issues)

**Note:** We don't use milestones or project boards.

## Guidelines for triage workflow

The following are guidelines as we cannot cover all situations.
Use common sense, do your best, and you'll do all right.
Don't be afraid to ask for help.

### Apply labels to issues

All issues should have labels attached to them.
Read the [issue-labeling guide](./issue-labeling.md) to get all the necessary info.

In general, make a good-faith effort to label issues correctly.

### Closing issues

You can close an issue yourself if it's:

- Spam
- Obviously fixed

For really old issues, it's a good idea to ask the maintainers to decide if they want to keep or close the issue.

### Closing pull requests

You won't need to close PRs very often, but you can certainly do it in case of spam or malicious content in the PR diff.

### Reopen issues

Sometimes a bug is fixed with a PR that links to an issue.
When the PR is merged, the issue is automatically closed.
Sometimes the bug was not really fixed, and someone says: "Hey this is still broken for me."
In that case, re-open the issue only if it's _definitely_ the same problem (users often associate different problems together incorrectly).
Otherwise, ask the user to open a new issue if it seems like it is different.

### Assign issues

You can assign an issue to yourself, or to somebody else, so that others know who's going to work on the issue.
GitHub allows issues to be assigned to:

- any project collaborator, or
- to any non-collaborator who has _created_ or _commented_ on the issue

You can assign whoever makes sense.

### Mark duplicate issues and pull requests

If you see an issue/discussion that's an obvious duplicate:

1. Attach a `duplicate` label
1. Use the "Duplicate of" functionality [GitHub docs, about duplicate issues and pull requests](https://docs.github.com/en/free-pro-team@latest/github/managing-your-work-on-github/about-duplicate-issues-and-pull-requests)
1. Close the issue/discussion

Follow the same workflow to mark duplicate PRs.

### Request PR reviews

You can request a review from one of the maintainers, if needed, to get the PR review process rolling (again).

### Lock and unlock discussions

Sometimes a discussion can go sour, like when people call each other names, or post spam, or veer off-topic.
Ideally warn the user with an `auto:bad-vibes` label first, and then use the `auto:discussion-closed` label if problems persist.

### Going from `status:requirements` to actionable issue

One of the most important non-code contributions people can do is help features and fixes go from `status:requirements` to a actionable issue.
We use the label `status:requirements` to mean "more information or research is needed before someone could start coding this".

It can sometimes be an oversight of the maintainers, but more often it's because there are requirements or edge cases to consider and the user hasn't got an opinion or time to think about them and contribute enough.
Sometimes it can be because there's a need for some research and "design" decisions to be made, which may require maintainers to do, but it's not high enough priority to justify the time yet.

In a way `status:requirements` means "someone's going to need to put more thought into this before it can move forward to development".
It can also mean "don't start this now because you might do something which can't be accepted into the code base".
