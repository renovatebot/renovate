---
title: GitLab security
---

# Security considerations when running Renovate against GitLab.com

Make sure you understand GitLab's security model before you run Renovate against GitLab, whether through the Mend-hosted app or a self-hosted deployment.

!!! warning
  If you have any doubts or concerns about this content that could affect other users, please follow our [Security Policy](https://github.com/renovatebot/renovate/security/policy) and report them confidentially.

## Mend-hosted Renovate

In July 2026, Mend relaunched its hosted Renovate app for GitLab.com.
You can set it up [by following these instructions](https://docs.mend.io/integrations/latest/install-mend-developer-platform-for-gitlab-com) when logging into [the Mend Developer Platform](https://developer.mend.io).

!!! tip
  The GitLab user who onboards an organization becomes the account used to create commit statuses, issues, and MRs.
  <br>
  Mend recommends creating a dedicated user solely for the integration with the Mend Developer Platform, and completing the rest of the installation as that dedicated user, rather than using a personal account.

The previous Mend-hosted Renovate for GitLab.com ran inside GitLab CI, using `CI_JOB_TOKEN` credentials, which we found [too risky to run as a shared service](#running-in-gitlab-ci) and retired.
Although GitLab has improved this since we retired the previous hosted app, we have since relaunched the app using [an OAuth app](#running-as-an-oauth-app), which avoids those risks.

## Security model

### Running in GitLab CI

GitLab's CI job-token permission model (the token was called `CI_BUILD_TOKEN` until it was renamed `CI_JOB_TOKEN` in GitLab 9.0) was overhauled in GitLab 8.12 (2016-09), so jobs now run with the permissions of the user account which _triggered_ the pipeline.
The token was originally limited to read-only permissions and a small set of API endpoints, but its write scope has grown significantly since: it can now push to its own project's repository, push cross-project to allowlisted projects, publish to the Package Registry, and more.
Historically, any pipeline triggered by a user account thus had permissions to:

- read any repository which that account has access to
- publish packages to them

This is why we retired the original Mend-hosted GitLab app: a pipeline run for one customer, under a shared bot account, could read or write to any other project that account had access to.

GitLab introduced a [CI/CD job token allowlist](https://docs.gitlab.com/ci/jobs/ci_job_token/) in GitLab 15.9 (2023-02): a job token from one project can no longer authenticate against another project's API just because the triggering user has access to both.
The target project must explicitly add the source project, or group, to its allowlist first, and the triggering user must still have their own permission to perform the action.
As of GitLab 18.0 (2025-05), this allowlist is enabled and enforced for every project on GitLab.com, including projects created before the allowlist existed, and can't be disabled there.
If you administer a GitLab Self-Managed or Dedicated instance, note that admins can still disable this instance-wide setting even on GitLab 18.0+, so confirm it's actually enforced rather than switched off.

Even with the allowlist enabled, public and internal projects still expose some resources, such as artifacts, the container/package registry, releases, and repository contents, to a job token from any project, allowlisted or not.
So the advice below still applies regardless of allowlist status.

If you run Renovate yourself inside your own GitLab CI pipelines, you should still only commit to a project you trust completely, since a malicious project could steal repository data, publish fake releases, or spam releases within its allowlisted scope.
You should also remember that when accounts are invited into projects or groups on GitLab, acceptance happens automatically.
If you are running a shared self-hosted Renovate service, we recommend you:

- Run a shared service only within projects where all users already have equivalent visibility/access to each other's data, or where there's a low risk that a user would try to gain access to a private project they don't otherwise have access to
- If running with `autodiscover`, also configure a value for `autodiscoverFilter` so that Renovate can't be invited to projects or groups you don't intend

### Running as an OAuth app

An alternative to running with a shared user's personal access token is to run using per-installation OAuth tokens: users explicitly authorize an OAuth app to act on specific groups or projects they choose, rather than a shared bot account being invited, and auto-accepted, into projects without its own consent.

This is the model the relaunched Mend-hosted GitLab app uses.
It avoids the "single shared bot identity reachable from every onboarded customer" failure mode described above, since each authorization is scoped to the projects or groups an admin actually selects, and commits/Merge Requests are attributable to that authorization rather than one global bot account.
We considered Project and Group Access Tokens as an alternative, but both remain gated behind paid tiers on gitlab.com, which would have excluded free-plan users from the service.

One limitation to be aware of: GitLab's OAuth scopes (`api`, `read_repository`, `write_repository`, and so on) are granted at the level of the _authorizing user_, not restricted to specific projects by GitLab itself.
The resulting token is therefore as capable as the authorizing user's own GitLab account, not limited to the group(s) selected during onboarding, by any GitLab-enforced boundary, unlike a Project Access Token, which GitLab itself would restrict to a single project.
GitLab does support project/group-scoped access for fine-grained personal access tokens, but not yet for OAuth application tokens.

## Acknowledgments

Thank you to Nejc Habjan for bringing this security challenge to our attention, and also to his colleagues at Siemens for their help researching the risks.
Thanks also to the GitLab security team for being responsive to our questions.
