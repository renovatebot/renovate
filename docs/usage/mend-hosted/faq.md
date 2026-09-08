# Frequently Asked Questions

## I'm hitting a `timeout` / `kernel-out-of-memory` limit with a `pnpm`/`yarn` project

If you're seeing that your jobs are regularly hitting a `timeout` / `kernel-out-of-memory`, this might be due to a package manager trying to update a large set of dependencies.

On Mend-hosted apps, it is recommended to use the repo-level configuration, [`toolSettings.nodeMaxMemory`](../configuration-options.md#toolsettingsnodemaxmemory), to tune the maximum memory available for the `pnpm`/`yarn` commands to use this.

Mend-hosted apps don't set a maximum allowed `nodeMaxMemory`, so you can use [the upper limit of memory from your plan](./overview.md#resources-and-scheduling) as the maximum limit.

It is recommended to set this between 1.5GB and 2.5GB but may require tweaking according to your repository.

!!! note
  It is at the discretion of Mend to raise the memory limit for repositories, in a similar way to how [there are increased resources for Open Source projects on Renovate Cloud](https://github.com/renovatebot/renovate/discussions/33617).

## How can I run arbitrary commands through [`postUpgradeTasks`](../configuration-options.md#postupgradetasks)?

As noted [in the `postUpgradeTasks` documentation](../configuration-options.md#postupgradetasks), a self-hosted administrator must allowlist any arbitrary commands that can run on their deployment.
This is to prevent both an ["insider attack"](../security-and-permissions.md#execution-of-code-insider-attack) and an ["outsider attack"](../security-and-permissions.md#execution-of-code-outsider-attack) that may occur when arbitrary commands execute.
../configuration-options.md#toolsettingsnodemaxmemory

Often, Renovate is a central service within a company, where there is _some level_ of trust in its users.
However, with Mend-hosted Renovate we're hosting a mix of users on the public Internet that we can't necessarily trust.

Although we harden Mend-hosted infrastructure more than a typical Renovate deployment, we still do not allow arbitrary command execution through `postUpgradeTasks`.
Depending on which plan of Renovate Cloud you're using, we may make it possible to allowlist command(s) you wish to run.

### Community (Free) users

Free users cannot modify nor request arbitrary commands for `postUpgradeTasks`.

### Community (OSS) users

Trusted Open Source projects [on the Community (OSS) plan](https://github.com/renovatebot/renovate/discussions/33617) can [raise a Mend Hosted Request on our GitHub Discussions](https://github.com/renovatebot/renovate/discussions/new?category=mend-hosted-request), requesting the allowlisting of a given command.

Acceptance is at the discretion of Mend.

### Enterprise and Mend AppSec users

If you are a paying Mend customer, you have access to control [a number of self-hosted configuration options for Renovate](#enterprise-and-mend-appsec-users-environment-variables).

One such variable is `RENOVATE_ALLOWED_COMMANDS`, which allows controlling the [`allowedCommands`](../self-hosted-configuration.md#allowedcommands) that a repository can run.
By configuring this, you can allow commands to run in your repository.

These variables can be managed by a repository administrator, and can also be set on the organisation level.

There is a balance between ease of use and security - remember that allowlisting commands can lead to a malicious dependency then executing within your project ([an "outsider attack"](../security-and-permissions.md#execution-of-code-outsider-attack)).

We recommend you restrict this to a subset of commands that need to run:

```
RENOVATE_ALLOWED_COMMANDS=["^make tidy$"]
```

However, note that by calling a `make` task, other arbitrary command execution can occur.

!!! tip
  There is currently no validation pre-save to confirm if you're entering values that are valid Renovate configuration.
  <br>
  After making a change to variable(s), we recommend triggering a new job to ensure that the job does not fail with `config-validation`.

## What environment variables can I set?

In June 2026, Mend allowed all repositories to be able to set environment variables, separate from repository secrets.

There are per-plan differences on what can be specified which you can see below.

### Community (Free) users' environment variables

Community (Free) users can control anything that is [repository config](../configuration-options.md), via environment variables.

This, for instance, allows a more straightforward way to default [`minimumReleaseAge`](../configuration-options.md#minimumreleaseage)

### Community (OSS) users' environment variables

Community (OSS) projects have the same access as Community (Free) users.

### Enterprise and Mend AppSec users' environment variables

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

## What IP Addresses are used by Mend Renovate Cloud?

If you are looking at restricting access to your source code via IP allowlisting, you will need to know which public IPs Mend's Developer Platform accesses from.

These can be found documented [on the Mend docs site](https://docs.mend.io/platform/latest/ip-addresses-used-by-mend-io) under the `developer-platform` section.

- the `us` grouping is for [`developer.mend.io`](https://developer.mend.io/)
- the `eu` grouping is for [`developer-eu.mend.io/`](https://developer-eu.mend.io/)
