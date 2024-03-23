# GitLab

## Authentication

First, [create a Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) for the bot account.

If you are using a Group access token, the token must have Developer role or higher permissions in order to create issues and merge requests.
The token must have Maintainer permissions in order to perform Automerge.

For real runs, give the PAT these scopes:

- `read_user`
- `api`
- `write_repository`
- `read_registry` (only if Renovate needs to access the [GitLab Container registry](https://docs.gitlab.com/ee/user/packages/container_registry/))

For dry runs, give the PAT these scopes:

- `read_user`
- `read_api`
- `read_repository`
- `write_repository` (when using autodiscover)
- `read_registry` (only if Renovate needs to access the [GitLab Container registry](https://docs.gitlab.com/ee/user/packages/container_registry/))

Let Renovate use your PAT by doing _one_ of the following:

- Set your PAT as a `token` in your `config.js` file
- Set your PAT as an environment variable `RENOVATE_TOKEN`
- Set your PAT when you run Renovate in the CLI with `--token=`

Remember to set `platform=gitlab` somewhere in your Renovate config file.

If you're using a private [GitLab container registry](https://docs.gitlab.com/ee/user/packages/container_registry/), you must:

- Set the `RENOVATE_HOST_RULES` CI variable to `[{"matchHost": "${CI_REGISTRY}","username": "${GITLAB_USER_NAME}","password": "${RENOVATE_TOKEN}", "hostType": "docker"}]`.
- Make sure the user that owns the `RENOVATE_TOKEN` PAT is a member of the corresponding GitLab projects/groups with the right permissions.
- Make sure the `RENOVATE_TOKEN` PAT has the `read_registry` scope.

You may want to set `FORCE_COLOR: 3` or `TERM: ansi` to the job, in order to get colored output.
[GitLab Runner runs the container’s shell in non-interactive mode, so the shell’s `TERM` environment variable is set to `dumb`.](https://docs.gitlab.com/ee/ci/yaml/script.html#job-log-output-is-not-formatted-as-expected-or-contains-unexpected-characters)

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will accept the Merge Request without further configuration, and respect the strategy defined in the Merge Request, and this cannot be overridden yet

## Server version dependent features

We use the GitLab [version API](https://docs.gitlab.com/ee/api/version.html) to fetch the server version.
You can use the experimental feature flag [`RENOVATE_X_PLATFORM_VERSION`](../../../self-hosted-experimental.md#renovate_x_platform_version) to set a specific server version.
By setting the server version yourself, you save a API call that fetches the server version.

- Use `Draft:` MR prefix instead of `WIP:` prefix since `v13.2.0`
- Do not truncate Markdown body to 25K chars since `v13.4.0`
- Allow configure reviewers since `v13.9.0`

## Multiple merge request assignees

Due to licensing restrictions [multiple assignees](https://docs.gitlab.com/ee/user/project/issues/multiple_assignees_for_issues.html) are only available in GitLab Premium self-managed, GitLab Premium SaaS, and higher tiers.
Because of a safeguard in [GitLab's API](https://github.com/renovatebot/renovate/pull/14212#issuecomment-1040189712) if multiple assignees are set, but not available to the project, only the first assignee will be applied.
