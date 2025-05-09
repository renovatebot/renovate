# GitLab

## Authentication

You can authenticate Renovate to GitLab, with _one_ of these methods:

- [Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html)
- [Project Access Token](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html)
- [Group Access Token](https://docs.gitlab.com/ee/user/group/settings/group_access_tokens.html)

### Three ways to authenticate, choose one

To start, create either:

- a [Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html#create-a-personal-access-token) for the bot account
- or a [Project Access Token](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html#create-a-project-access-token) if Renovate only needs to check and update _one_ project. We do not recommend Project Access Tokens, as you need to configure Renovate, and the token, for _each_ project
- or a [Group Access Token](https://docs.gitlab.com/ee/user/group/settings/group_access_tokens.html#create-a-group-access-token-using-ui) to the group Renovate will be working on

#### Bot or token must have at least developer role

The bot account, or token, must have at least the Developer role.
The developer role allows Renovate to [create issues and merge requests](https://docs.gitlab.com/ee/user/permissions.html#project-members-permissions).

#### If you want Renovate to automerge, give appropriate permissions

If you are using automerge, the bot account, or token, must have the appropriate ["Allowed to merge" permission on the protected branch](https://docs.gitlab.com/ee/user/project/protected_branches.html#require-everyone-to-submit-merge-requests-for-a-protected-branch) of your projects.

#### If only maintainers are allowed to merge, give Maintainer role

If merging is restricted to Maintainers, the bot account or token must have the Maintainer role.

#### Setting up Project Access Tokens or Group Access Tokens

If you are using a project access token, or a group access token, GitLab creates an [internal](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html#bot-users-for-projects) [bot](https://docs.gitlab.com/ee/user/group/settings/group_access_tokens.html#bot-users-for-groups) user for you.
This bot user is the one that will be used to create merge requests and issues.

Use the name and email of this bot user to configure Renovate when [verifing users using push rules](#verifying-users-using-push-rules).
For group access tokens, an expiration date is required, unlike project access tokens where it is optional.

To keep using the same GitLab-generated bot account you must [rotate/refresh the Group Access Token](https://docs.gitlab.com/ee/api/group_access_tokens.html#rotate-a-group-access-token) _before_ the token's expiry date.

We refer to personal access tokens, project access tokens and group access tokens as _access tokens_ in the instructions that follow.

#### Permissions for access tokens on real runs

For real runs, give the access token these scopes:

- `api`

#### Permissions for access tokens on dry runs

For dry runs, give the access token these scopes:

- `read_api`

#### Letting Renovate use your access token

Let Renovate use your access token by doing _one_ of the following:

- Set your access token as a `token` in your `config.js` file
- Set your access token as an environment variable `RENOVATE_TOKEN`
- Set your access token when you run Renovate in the CLI with `--token=`

#### Set `platform=gitlab` in your Renovate config file

Remember to set `platform=gitlab` somewhere in your Renovate config file.

#### Setting up Renovate for a Private Gitlab container registry

If you use a private [GitLab container registry](https://docs.gitlab.com/ee/user/packages/container_registry/), you must:

- Set the `RENOVATE_HOST_RULES` CI variable to `[{"matchHost": "${CI_REGISTRY}","username": "${GITLAB_USER_NAME}","password": "${RENOVATE_TOKEN}", "hostType": "docker"}]`.

  Alternatively, if [`detectHostRulesFromEnv`](../../../self-hosted-configuration.md#detecthostrulesfromenv) is enabled, you can set the CI variables `DOCKER_REGISTRY_GITLAB_COM_USERNAME=${GITLAB_USER_NAME}` and `DOCKER_REGISTRY_GITLAB_COM_PASSWORD=${RENOVATE_TOKEN}`.

- Make sure the user that owns the access token is a member of the corresponding GitLab projects/groups with the right permissions.
- Make sure the access token has the `read_registry` scope.

You may also use a dedicated [Deploy Token](https://docs.gitlab.com/ee/user/project/deploy_tokens/) instead of using `RENOVATE_TOKEN` as the password in the above host rule example.

#### Get colored output

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

[Multiple assignees](https://docs.gitlab.com/ee/user/project/issues/multiple_assignees_for_issues.html) are only available on GitLab Premium and Ultimate tiers.
Because of a safeguard in [GitLab's API](https://github.com/renovatebot/renovate/pull/14212#issuecomment-1040189712) if multiple assignees are set, but not available to the project, only the first assignee will be applied.

## Verifying users using push rules

When verifying users using [push rules](https://docs.gitlab.com/ee/user/project/repository/push_rules.html#verify-users), you must use the name and email of the bot user for `gitAuthor`.
