# Environment Variable Handling

For security reasons, Renovate does not expose all environment variables to child processes.
Instead, Renovate will use an allowlist of environment variables which it passes to any processes it calls.

By default, Renovate will **always** pass the following environment variables to child processes:

<!-- Autogenerate basicEnvVars -->

<!-- prettier-ignore -->
!!! note
    Some managers pass additional environment variables where necessary.
    <br>
    This is not currently documented in full - you will need to review Renovate's code to see the full list.

As a self-hosted administrator, it is possible to allowlist other environment variables that repository owners can set, using:

- [`allowedEnv`](./self-hosted-configuration.md#allowedenv)
- [`customEnvVariables`](./self-hosted-configuration.md#customenvvariables)
- [`extends: ["global:safeEnv"]`](./presets-global.md#globalsafeenv)

When using `allowedEnv`, users will then be able to specify the value for any environment variables allowlisted, using the [`env`](./configuration-options.md#env) configuration option in their repository configuration.
