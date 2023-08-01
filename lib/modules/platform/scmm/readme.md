# SCM-Manager

Renovate supports [SCM-Manager](https://scm-manager.org).

## Authentication

First, create an API Key for your technical Renovate user in SCM-Manager.
The technical user should be configured properly with name and email address.
Then let Renovate use your API Key by setting the `RENOVATE_TOKEN` environment variable with your key.

You must set `platform=scmm` in your Renovate config file.

The technical user needs at least the permissions to read your repository read and create pull request. This can be achieved by granting the permission role "OWNER" to your technical Renovate user.
