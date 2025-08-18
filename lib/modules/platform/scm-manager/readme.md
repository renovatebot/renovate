# SCM-Manager

Renovate supports the [SCM-Manager](https://scm-manager.org) platform.
This platform is considered experimental.

## Authentication

1. Create an API Key for your technical Renovate user in SCM-Manager
1. The technical user _must_ have a valid name and email address
1. Put the API key in the `RENOVATE_TOKEN` environment variable, so that Renovate can use it

## Set correct platform

You must set the [`platform`](../../../self-hosted-configuration.md#platform) config option to `scm-manager` in your admin config file.

## Set permissions

The technical user must have the permissions to:

1. read the repository
1. pull/checkout the repository
1. push/commit the repository
1. create pull requests for the repository

Those permissions can be granted on a repository level within the permission settings of each repository.

## Install Review Plugin

To let Renovate access the Pull Request API, you must install the Review Plugin.
Find the list of available plugins by going to to Administration -> Plugins -> Available.

## Supported versions of SCM-Manager

Renovate supports SCM-Manager major version `2.x` and `3.x`.

The minimum version for the `2.x` range is `2.48.0`.
The minimum version for the `3.x` range is `3.0.0`.

## Automerge

Currently, the Renovate automerge feature is not supported by the SCM-Manager platform.
Every pull request requires merging them manually for now.
