# AGENTS.md

This file provides guidance for AI agents working in this repository.

## What is Renovate?

Renovate is an automated dependency update tool that scans repositories for dependency files, checks for newer versions via datasources, and creates pull requests to update them. It supports 90+ package managers and multiple hosting platforms (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Forgejo, Gerrit, etc.).

## Raising issues/feature requests

**Do not create GitHub Issues directly.** Issue creation is restricted to repository administrators. Creating an issue as a non-administrator will result in being blocked from the repository.

Instead, use **GitHub Discussions**: https://github.com/renovatebot/renovate/discussions/new/choose

Two discussion categories are available:

- **Request help** (`.github/DISCUSSION_TEMPLATE/request-help.yml`) - for bugs, questions, or unexpected behavior. Include a minimal reproduction and relevant logs where possible.
- **Suggest an idea** (`.github/DISCUSSION_TEMPLATE/suggest-an-idea.yml`) - for feature requests or improvements.

**Do not attempt** to create a Discussion body without following the template, as it may result in being blocked from the repository.

**Security vulnerabilities must not be reported on GitHub.** See [`SECURITY.md`](./SECURITY.md) for more details.

## Contributing Notes

- PRs require 100% test coverage. Use `/* v8 ignore ... */` sparingly when tests wouldn't prove anything.
- Do not force push PR branches.
- Follow the PR template (`.github/pull_request_template.md`).
