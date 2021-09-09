# GitLab

## Features awaiting implementation

- The `automergeStrategy` configuration option has not been implemented for this platform, and all values behave as if the value `auto` was used. Renovate will accept the Merge Request without further configuration, and respect the strategy defined in the Merge Request, and this cannot be overridden yet

## Server version dependent features

We use the GitLab [version API](https://docs.gitlab.com/ee/api/version.html) to fetch the server version.
You can use the experimental feature flag [`RENOVATE_X_PLATFORM_VERSION`](https://docs.renovatebot.com/self-hosted-experimental/#renovate_x_platform_version) to set a specific server version.
By setting the server version yourself, you save a API call that fetches the server version.

- Use `Draft:` MR prefix instead of `WIP:` prefix since `v13.2.0`
- Do not truncate Markdown body to 25K chars since `v13.4.0`
- Allow configure reviewers since `v13.9.0`
