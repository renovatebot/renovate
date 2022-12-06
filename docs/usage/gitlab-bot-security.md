---
title: GitLab bot security
---

# GitLab bot security

You should understand GitLab's security model, before deciding to run a "bot" service like Renovate on GitLab, particularly the pipeline credentials.

**Important**: If you have any doubts or concerns about this content that could affect other users, please follow our [Security Policy](https://github.com/renovatebot/renovate/security/policy) and report them confidentially.

## `CI_JOB_TOKEN` permissions

The concept of `CI_JOB_TOKEN` permissions was [overhauled in GitLab release 8.12](https://about.gitlab.com/releases/2016/09/22/gitlab-8-12-released/), jobs are now run with the permissions of the user account which _triggered_ the pipeline.
For security reasons the token was limited to read-only permissions and a limited set of API endpoints, but it’s been extended to allow [write access to the GitLab Package Registry](https://docs.gitlab.com/ee/api/index.html#gitlab-ci-job-token).
Any pipeline triggered by a user account thus has permissions to read any repository which that account has access to as well as publish packages to them.

With the current GitLab CI permissions model, you should avoid committing to any project which you don’t trust completely, because that project could maliciously steal repository data, publish fake releases, or spam releases.

## Risks of hosting a Renovate GitLab app/bot/service

The GitLab security model means that the risks of running a _public_ bot service on GitLab are too high, which is why the existing service has been suspended until an alternate security model is ready.

It's also important to remember that when accounts are invited into projects or groups on GitLab, acceptance happens automatically (which was a useful feature to leverage for a shared service).

If you are running a self-hosted Renovate service, it is advisable to:

- Run a shared service only within projects which have shared visibility/security within the users, or which have a low risk that a user would try to gain access to a private project they don't otherwise have access to
- If running with `autodiscover`, also configure a value for `autodiscoverFilter` so that the bot can't be invited to projects or groups you don't intend

## Security solutions and workarounds

The following research notes may help you to assess the GitLab bot security risk.

### Public projects only

If a bot service is run on public projects only, then the risk of private project data being accessed by unauthorized users is zero.
But malicious users can still spoof or spam packages to any other public project they are not a member of, so that rules out this approach for a public hosted service.

A public-visibility-only bot service should be low risk for most self-hosted GitLab instances.
There is still a small problem that you can't _prevent_ users from inviting the bot into private projects if they are not aware of the risks of doing so.

### Project Access Tokens

[Project Access Tokens](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html) are a recently added feature for GitLab.
The main downsides to their use for a shared bot service are:

- It is not yet possible to [provision them through the API](https://gitlab.com/gitlab-org/gitlab/-/issues/238991), so project maintainers would need to provision a project bot account and then save it to Renovate manually and per-project
- Project Access Tokens are a paid-only feature for gitlab.com, which excludes a large percentage of the public service user base
- At the time of writing, there are still some issues with getting Project Access Tokens to trigger and authenticate CI
- Any service using such tokens would get MRs from a user like `@project_123_bot` which is less intuitive than `@renovate-bot`

The big benefit of Project Access Tokens is their limited scope, users with write access to one project cannot read/write to other projects.

### Group Access Tokens

Group Access Tokens are still in the planning stage, but may offer a more scalable way to manage a Renovate service.
Tokens could be provisioned into Renovate per-group and permissions/visibility would need to be kept uniform throughout the group to ensure escalation of privileges is not possible.

It should be noted though that many GitLab users _do not_ have uniform permissions/visibility throughout groups today, so this is a risk of Group Access Tokens in general.
Even [https://gitlab.com/gitlab-org](https://gitlab.com/gitlab-org) is a good example of how common it is to mix project visibility within a same group.

Similarly with Project Access Tokens, if they are a paid-only feature then it would exclude free users from using such a service.

### Skipping CI

The security problem described above is that if a user triggers a malicious pipeline then they can be exploited, so skipping CI altogether would seem to be a way to avoid that.
If Renovate can _reliably_ force CI skipping for both (a) branch push, and (b) MR creation/updating then there should be no security exploit risk, but of course then there are no tests run instead.
A possibility in future could be to combine this with a force push from a user or project token to trigger tests.

The above solution/workaround will be actively researched in collaboration with GitLab.

### OAuth

An alternative to a bot service running with a bot PAT would be to have it run using user OAuth tokens.
In this scenario, an OAuth app would be needed to allow users to "install" the bot into projects with members they trust not to exploit them, and then commits and Merge Requests would appear to be authored by the _user_, not any bot.
Bot services are better if they are provisioned with a "bot identity" so that users can quickly distinguish bot activity from real user activity.

## Recommended migration

Until the hosted app can be reactivated, we recommend users migrate to use self-hosted pipelines to run Renovate.
Please see the [renovate-bot/renovate-runner README on GitLab](https://gitlab.com/renovate-bot/renovate-runner/-/blob/HEAD/README.md) for instructions on how to set this up as easily as possible.

## Status of the Renovate app for GitLab

We're trying to find a workable design for the GitLab app, so we can enable it safely again.
If you have any ideas, open a [discussion](https://github.com/renovatebot/renovate/discussions) and let us know!

GitLab introduced Group Access Tokens & API for paid & self-hosted instances, but a good permission setup/flow is still not possible.
Check out [GitLab issue #346298](https://gitlab.com/gitlab-org/gitlab/-/issues/346298).

## Acknowledgments

Thank you to Nejc Habjan for bringing this security challenge to our attention, and also to his colleagues at Siemens for their help researching the risks.
Thanks also to the GitLab security team for being responsive to our questions.
