# Environment Variables

There are per-plan differences on what can be specified which you can see below.

## Community (Free) users' environment variables

Community (Free) users can control anything that is [repository config](../configuration-options.md), via environment variables.

This, for instance, allows a more straightforward way to default [`minimumReleaseAge`](../configuration-options.md#minimumreleaseage)

## Community (OSS) users' environment variables

Community (OSS) projects have the same access as Community (Free) users.

## Enterprise and Mend AppSec users' environment variables

If you are a paying Mend customer, in addition to being able to control repository config, you also have access to control the following environment variables:

| Variable                                                  | Config option                                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `RENOVATE_ALLOWED_COMMANDS`                               | [`allowedCommands`](../self-hosted-configuration.md#allowedcommands)                                                   |
| `RENOVATE_ALLOWED_ENV`                                    | [`allowedEnv`](../self-hosted-configuration.md#allowedenv)                                                             |
| `RENOVATE_ALLOWED_HEADERS`                                | [`allowedHeaders`](../self-hosted-configuration.md#allowedheaders)                                                     |
| `RENOVATE_ALLOWED_UNSAFE_EXECUTIONS`                      | [`allowedUnsafeExecutions`](../self-hosted-configuration.md#allowedunsafeexecutions)                                   |
| `RENOVATE_ALLOW_PLUGINS`                                  | [`allowPlugins`](../self-hosted-configuration.md#allowplugins)                                                         |
| `RENOVATE_ALLOW_SCRIPTS`                                  | [`allowScripts`](../self-hosted-configuration.md#allowscripts)                                                         |
| `RENOVATE_ALLOW_SHELL_EXECUTOR_FOR_POST_UPGRADE_COMMANDS` | [`allowShellExecutorForPostUpgradeCommands`](../self-hosted-configuration.md#allowshellexecutorforpostupgradecommands) |
| `RENOVATE_CUSTOM_ENV_VARIABLES`                           | [`customEnvVariables`](../self-hosted-configuration.md#customenvvariables)                                             |
| `RENOVATE_INHERIT_CONFIG`                                 | [`inheritConfig`](../self-hosted-configuration.md#inheritconfig)                                                       |
| `RENOVATE_INHERIT_CONFIG_FILE_NAME`                       | [`inheritConfigFileName`](../self-hosted-configuration.md#inheritconfigfilename)                                       |
| `RENOVATE_INHERIT_CONFIG_REPO_NAME`                       | [`inheritConfigRepoName`](../self-hosted-configuration.md#inheritconfigreponame)                                       |
| `RENOVATE_INHERIT_CONFIG_STRICT`                          | [`inheritConfigStrict`](../self-hosted-configuration.md#inheritconfigstrict)                                           |
