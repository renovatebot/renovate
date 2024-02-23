# SCM-Manager

Renovate supports the [SCM-Manager](https://scm-manager.org) platform.

## Authentication

1. Create an API Key for your technical Renovate user in SCM-Manager
1. The technical user _must_ have a valid name and email address
1. Put the API key in the `RENOVATE_TOKEN` environment variable, so that Renovate can use it

You must set the [`platform` config option](https://docs.renovatebot.com/self-hosted-configuration/#platform) to `scm-manager` in your Renovate config file.

The technical user needs the permissions to read and write your repository.
This can be achieved by granting the permission role "OWNER" to your technical Renovate user.
Additionally, the Review Plugin needs to be installed.
Otherwise, the pull request API will not be available.
Plugins can be installed under Administration -> Plugins -> Available.

Renovate supports SCM-Manager major version 2.x and 3.x.
The 2.x is supported since 2.48.0.
The 3.x is supported since 3.0.0.
