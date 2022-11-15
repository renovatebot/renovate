# GitLab

## Authentication

First, [create a Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) for the bot account.

For real runs, give the PAT these scopes:

- `read_user`
- `api`
- `write_repository`

For dry runs, give the PAT these scopes:

- `read_user`
- `read_api`
- `read_repository`

Let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

Remember to set `platform=gitlab` somewhere in your Renovate config file.

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will accept the Merge Request without further configuration, and respect the strategy defined in the Merge Request, and this cannot be overridden yet

## Server version dependent features

We use the GitLab [version API](https://docs.gitlab.com/ee/api/version.html) to fetch the server version.
You can use the experimental feature flag [`RENOVATE_X_PLATFORM_VERSION`](https://docs.renovatebot.com/self-hosted-experimental/#renovate_x_platform_version) to set a specific server version.
By setting the server version yourself, you save a API call that fetches the server version.

- Use `Draft:` MR prefix instead of `WIP:` prefix since `v13.2.0`
- Do not truncate Markdown body to 25K chars since `v13.4.0`
- Allow configure reviewers since `v13.9.0`

## Multiple merge request assignees

Due to licensing restrictions [multiple assignees](https://docs.gitlab.com/ee/user/project/issues/multiple_assignees_for_issues.html) are only available in GitLab Premium self-managed, GitLab Premium SaaS, and higher tiers.
Because of a safeguard in [GitLab's API](https://github.com/renovatebot/renovate/pull/14212#issuecomment-1040189712) if multiple assignees are set, but not available to the project, only the first assignee will be applied.
