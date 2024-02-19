# SCM-Manager

Renovate supports the [SCM-Manager](https://scm-manager.org) platform.

## Authentication

1. Create an API Key for your technical Renovate user in SCM-Manager.
2. The technical user _must_ have the correct name and email address.
3. Put the API key in the `RENOVATE_TOKEN` environment variable, so that Renovate can use it.

You must set the [`platform`](https://docs.renovatebot.com/self-hosted-configuration/#platform) to `scmm` in your your Renovate config file.

The technical user needs at least the permissions to read your repository read and create pull request. This can be achieved by granting the permission role "OWNER" to your technical Renovate user.
