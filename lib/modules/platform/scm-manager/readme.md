# SCM-Manager

Renovate supports the [SCM-Manager](https://scm-manager.org) platform.

## Authentication

1. Create an API Key for your technical Renovate user in SCM-Manager
1. The technical user _must_ have a valid name and email address
1. Put the API key in the `RENOVATE_TOKEN` environment variable, so that Renovate can use it

## Set correct platform

You must set the [`platform`](../../../self-hosted-configuration.md#platform) config option to `scm-manager` in your Renovate config file.

## Set permissions

The technical user must have permission to read and write to your repository.
You can do this by granting the permission role "OWNER" to the technical Renovate user.

## Install Review Plugin

To let Renovate access the Pull Request API, you must install the Review Plugin.
Find the list of available plugins by going to to Administration -> Plugins -> Available.

## Supported versions of SCM-Manager

Renovate supports SCM-Manager major version `2.x` and `3.x`.

The minimum version for the `2.x` range is `2.48.0`.
The minimum version for the `3.x` range is `3.0.0`.
