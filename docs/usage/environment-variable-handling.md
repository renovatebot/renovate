# Environment Variable Handling

## For Renovate

Renovate itself can be configured through a number of environment variables that correspond with [global self-hosted configuration options](./self-hosted-configuration.md), as well as some [repository configuration options](./configuration-options.md).
These environment variables are prefixed with `RENOVATE_`.

Renovate also has some ["experimental" variables that can be used with self-hosted deployments](./self-hosted-experimental.md).

It is also possible to use the following configuration options to control Renovate's environment variables:

- [`processEnv`](./self-hosted-configuration.md#processenv): in a configuration file (i.e. `config.js`), allows specifying the values that Renovate will receive in its environment

## With child processes

For security reasons, Renovate does not expose all environment variables to child processes.
Instead, Renovate will use an allowlist of environment variables which it passes to any processes it calls.

This is an intentional decision to protect against two key attack vectors:

- an ["insider attack"](./security-and-permissions.md#execution-of-code-insider-attack) from a user of your self-hosted Renovate deployment
- an ["outsider attack"](./security-and-permissions.md#execution-of-code-outsider-attack) from a malicious dependency

By reducing the environment variables provided to child processes, we can reduce the risk of a malicious actor from receiving access to potentially sensitive information, such as authentication tokens.

By default, Renovate will **always** pass the following environment variables to child processes:

<!-- Autogenerate basicEnvVars -->

<!-- prettier-ignore -->
!!! note
    Some managers pass additional environment variables where necessary.
    <br>
    For example, Renovate will convert Host Rules to the respective environment variables when calling `npm`, `pnpm` and `yarn`.
    <br>
    This is not currently documented in full - you will need to review Renovate's code to see the full list.

As a self-hosted administrator, it is possible to allowlist other environment variables that repository owners can set, using:

- [`allowedEnv`](./self-hosted-configuration.md#allowedenv): allows users to specify values for allowlisted environment variables in their repository configuration using [`env`](./configuration-options.md#env)
- [`customEnvVariables`](./self-hosted-configuration.md#customenvvariables): administrator-defined environment variables, injected directly into every child process. Users cannot override these in their repository configuration
- [`exposeAllEnv`](./self-hosted-configuration.md#exposeallenv): ⚠️ dangerously expose all environment variables from the Renovate process to all child processes
- [`extends: ["global:safeEnv"]`](./presets-global.md#globalsafeenv): a curated list of commonly used environment variables that should be safe to allow users to configure with [`env`](./configuration-options.md#env). Used in Mend-hosted Renovate

With these option(s) configured, users will be able to set these environment variable(s) in their repository configuration using [`env`](./configuration-options.md#env).

## Templating
