# SCM-Manager

Renovate supports the [SCM-Manager](https://scm-manager.org) platform.

## Authentication

1. Create an API Key for your technical Renovate user in SCM-Manager
1. The technical user _must_ have a valid name and email address
1. Put the API key in the `RENOVATE_TOKEN` environment variable, so that Renovate can use it

You must set the [`platform`](../../../self-hosted-configuration.md#platform) config option to `scm-manager` in your Renovate config file.

The technical user must have permission to read and write to your repository.
You can do this by granting the permission role "OWNER" to the technical Renovate user.
Additionally, the Review Plugin needs to be installed.
Otherwise, the pull request API will not be available.
Plugins can be installed under Administration -> Plugins -> Available.

Renovate supports SCM-Manager major version `2.x` and `3.x`.
The minimum version for the `2.x` range is `2.48.0`.
The minimum version for the `3.x` range is `3.0.0`.
