---
title: Docker
description: Docker Package Manager Support in Renovate
---

# Docker

Renovate supports upgrading dependencies in various types of Docker definition files:

- Docker's `Dockerfile` files
- Docker Compose `docker-compose.yml`, `compose.yml` files
- Visual Studio Code dev containers and GitHub Codespaces images and features
- CircleCI config files
- Kubernetes manifest files
- Ansible configuration files

## How It Works

1. Renovate searches in each repository for any files matching each manager's configured `fileMatch` pattern(s)
1. Matching files are parsed, Renovate checks if the file(s) has any Docker image references (e.g. `FROM` lines in a `Dockerfile`)
1. If the image tag in use "looks" like a version (e.g. `myimage:1`, `myimage:1.1`, `myimage:1.1.0`, `myimage:1-onbuild`) then Renovate checks the Docker registry for upgrades (e.g. from `myimage:1.1.0` to `myimage:1.2.0`)

## Preservation of Version Precision

By default, Renovate preserves the precision level specified in the Docker images.
For example, if the existing image is pinned at `myimage:1.1` then Renovate only proposes upgrades to `myimage:1.2` or `myimage:1.3`.
This means that you will not get upgrades to a more specific versions like `myimage:1.2.0` or `myimage:1.3.0`.
Renovate does not yet support "pinning" an imprecise version to a precise version, e.g. from `myimage:1.2` to `myimage:1.2.0`, but it's a feature we'd like to work on one day.

## Version compatibility

Although suffixes in SemVer indicate pre-releases (e.g. `v1.2.0-alpha.2`), in Docker they typically indicate compatibility, e.g. `1.2.0-alpine`.
By default Renovate assumes suffixes indicate compatibility, for this reason Renovate will not _change_ any suffixes.
Renovate will update `1.2.0-alpine` to `1.2.1-alpine` but never updates to `1.2.1` or `1.2.1-stretch` as that would change the suffix.

If this behavior does not suit a particular package you have, Renovate allows you to customize the `versioning` scheme it uses.
For example, you have a Docker image `foo/bar` that sticks to SemVer versioning.
This means that you need to tell Renovate that suffixes indicate pre-release versions, and not compatibility.

You could then use this `packageRules` array, to tell Renovate to use `semver` versioning for the `foo/bar` package:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["foo/bar"],
      "versioning": "semver"
    }
  ]
}
```

Another example is the official `python` image, which follows `pep440` versioning.

```json title="Telling Renovate to use the pep440 versioning scheme"
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["python"],
      "versioning": "pep440"
    }
  ]
}
```

If traditional versioning doesn't work, try Renovate's built-in `loose` `versioning`.
Renovate will perform a best-effort sort of the versions, regardless of whether they have letters or digits.

If both the traditional versioning, and the `loose` versioning do not give the results you want, try the `regex` `versioning`.
This approach uses regex capture group syntax to specify which part of the version string is major, minor, patch, pre-release, or compatibility.
See the docs for `versioning` for documentation and examples of `regex` versioning in action.

## Digest Pinning

We recommend that you pin your Docker images to an exact digest.
By pinning to a digest you make your Docker builds immutable, every time you do a `pull` you get the same content.

If you work with dependencies in the JavaScript/npm ecosystem, you may be used to exact versions being immutable.
For example, if you set a version like `2.0.1`, you and your colleagues always get the exact same "code".

Docker's tags are not immutable versions, even if tags _look_ like a version.
You probably expect `myimage:1` and `myimage:1.2` to change over time, but you might incorrectly assume that `myimage:1.2.0` never changes.
Although it probably _shouldn't_, the reality is that any Docker image tag _can_ change content, and potentially break.

By replacing Docker tags with Docker digests as the image's primary identifier you'll get immutable builds.
Working with strings like `FROM node@sha256:d938c1761e3afbae9242848ffbb95b9cc1cb0a24d889f8bd955204d347a7266e` is hard.
Luckily Renovate can update the digests for you.

When pinning a digest, Renovate retains the Docker tag in the `FROM` line for readability, like this: `FROM node:14.15.1@sha256:d938c1761e3afbae9242848ffbb95b9cc1cb0a24d889f8bd955204d347a7266e`.

## Digest Updating

If you follow our advice to replace a tag like `node:14` with a pinned digest like `node:14@sha256:d938c1761e3afbae9242848ffbb95b9cc1cb0a24d889f8bd955204d347a7266e`, you will get Renovate PRs whenever the `node:14` image is updated on Docker Hub.

Previously this update would have been "invisible" to you - one day you pull code that represents `node:14.15.0` and the next day you pull code that represents `node:14.15.1`.
But you can never be sure, especially as Docker caches.
Maybe some of your colleagues, or worse still your build machine, are stuck on an older version with a security vulnerability.

By pinning to a digest instead, you will get these updates via Pull Requests, or even committed directly to your repository if you enable branch automerge for convenience.
This makes sure everyone on your team uses the latest versions.

## Version Upgrading

Renovate also supports _upgrading_ versions in Docker tags, so from `myimage:1.2.0` to `myimage:1.2.1`, or from `myimage:1.2` to `myimage:1.3`.
If a tag looks like a version, Renovate will upgrade it like a version.

We recommend you use the `major.minor.patch` tagging scheme, so change `myimage:1` to `myimage:1.1.1` first.
This way you can see the changes in Renovate PRs.
You can see the difference between a PR that upgrades `myimage` from `1.1.1` to `1.1.2` and a PR that changes the contents of the version you already use (`1.1.1`).

By default, Renovate will upgrade `minor` and `patch` versions, so from `1.2.0` to `1.2.1`, but _not_ upgrade `major` versions.
If you wish to enable `major` versions: add the preset `docker:enableMajor` to the `extends` array in your `renovate.json` file.

Renovate has some Docker-specific intelligence when it comes to versions.
For example:

### Ubuntu codenames

Renovate understands [Ubuntu release code names](https://wiki.ubuntu.com/Releases) and will offer upgrades to the latest LTS release.

You must only use the _first_ term of the code name in _lowercase_.
So use `noble` for the Noble Numbat release.

For example, Renovate will offer to upgrade the following `Dockerfile` layer:

```diff
- FROM ubuntu:jammy
+ FROM ubuntu:noble
```

### Debian codenames

Renovate understands [Debian release code names and rolling updates schedule](https://wiki.debian.org/DebianReleases) and will offer upgrades to the latest stable release.
For example from `debian:bullseye` to `debian:bookworm`.

The Debian codename must be in _lowercase_.

For example, Renovate will offer to upgrade the following `Dockerfile` layer:

```diff
- FROM debian:bullseye
+ FROM debian:bookworm
```

## Configuring/Disabling

If you wish to make changes that apply to all Docker managers, then add them to the `docker` config object.
This is not foolproof, because some managers like `circleci` and `ansible` support multiple datasources that do not inherit from the `docker` config object.

If you wish to override Docker settings for one particular type of manager, use that manager's config object instead.
For example, to disable digest updates for Docker Compose only but leave them for other managers like `Dockerfile`, you would use this:

```json
{
  "docker-compose": {
    "digest": {
      "enabled": false
    }
  }
}
```

The following configuration options are applicable to Docker:

### Disable all Docker Renovation

Add `"docker:disable"` to your `extends` array.

### Disable Renovate for only certain Dockerfiles

Add all paths to ignore into the `ignorePaths` configuration field. e.g.

```json
{
  "extends": ["config:recommended"],
  "ignorePaths": ["docker/old-files/"]
}
```

### Enable Docker major updates

Add `"docker:enableMajor"` to your `extends` array.

### Disable digest pinning

Add `"default:pinDigestsDisabled"` to your `extends` array.

### Automerge digest updates

Add `"default:automergeDigest"` to your `extends` array.
If you want Renovate to commit directly to your base branch without opening a PR first, add `"default:automergeBranchPush"` to the `extends` array.

### Registry authentication

There are many different registries, and many ways to authenticate to those registries.
We will explain how to authenticate for the most common registries.

#### DockerHub

Here is an example of configuring a default Docker username/password in `config.js`.
The Docker Hub password is stored in a process environment variable.

```js title="config.js"
module.exports = {
  hostRules: [
    {
      hostType: 'docker',
      username: '<your-username>',
      password: process.env.DOCKER_HUB_PASSWORD,
    },
  ],
};
```

You can add more host rules, read the [`hostRules` documentation](./configuration-options.md#hostrules) for more information.

#### Self-hosted Docker registry

Say you host some Docker images yourself, and use a password to access your self-hosted Docker images.
In addition to self-hosting, you also pull images from Docker Hub, without a password.
In this example you would configure a specific Docker host like this:

```js
module.exports = {
  hostRules: [
    {
      hostType: 'docker',
      matchHost: 'your.host.io',
      username: '<your-username>',
      password: process.env.SELF_HOSTED_DOCKER_IMAGES_PASSWORD,
    },
  ],
};
```

#### AWS ECR (Amazon Web Services Elastic Container Registry)

##### Using access key id & secret

Renovate can authenticate with AWS ECR using AWS access key id & secret as the username & password, for example:

```json
{
  "hostRules": [
    {
      "hostType": "docker",
      "matchHost": "12345612312.dkr.ecr.us-east-1.amazonaws.com",
      "username": "AKIAABCDEFGHIJKLMNOPQ",
      "encrypted": {
        "password": "w...A"
      }
    }
  ]
}
```

##### Using `get-login-password`

Renovate can also authenticate with AWS ECR using the output from the `aws ecr get-login-password` command as outlined in
the [AWS documentation](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html#registry-auth-token).
To make use of this authentication mechanism, specify the username as `AWS`:

```json
{
  "hostRules": [
    {
      "hostType": "docker",
      "matchHost": "12345612312.dkr.ecr.us-east-1.amazonaws.com",
      "username": "AWS",
      "encrypted": {
        "password": "w...A"
      }
    }
  ]
}
```

#### Google Container Registry / Google Artifact Registry

##### Using Workload Identity

To let Renovate authenticate with [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity), you must:

- Configure Workload Identity
- Give the Service Account the `artifactregistry.repositories.downloadArtifacts` permission

###### With Application Default Credentials (self-hosted only)

To let Renovate authenticate with [ADC](https://cloud.google.com/docs/authentication/provide-credentials-adc), you must:

- Configure ADC as normal
- _Not_ provide a username, password or token

Renovate will get the credentials with the [`google-auth-library`](https://www.npmjs.com/package/google-auth-library).

###### With short-lived access token / GitHub Actions (self-hosted only)

```yaml title="Example for Workload Identity plus Renovate host rules"
- name: authenticate to google cloud
  id: auth
  uses: google-github-actions/auth@v2.1.8
  with:
    token_format: 'access_token'
    workload_identity_provider: ${{ env.WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ env.SERVICE_ACCOUNT }}

- name: renovate
  uses: renovatebot/github-action@v41.0.13
  env:
    RENOVATE_HOST_RULES: |
      [
        {
          matchHost: "us-central1-docker.pkg.dev",
          hostType: "docker",
          username: "oauth2accesstoken",
          password: "${{ steps.auth.outputs.access_token }}"
        }
      ]
  with:
    token: ${{ secrets.RENOVATE_TOKEN }}
    configurationFile: .github/renovate.json5
```

You can find a full GitHub Workflow example on the [renovatebot/github-action](https://github.com/renovatebot/github-action) repository.

##### Using long-lived service account credentials

To access the Google Container Registry (deprecated) or the Google Artifact Registry, use the JSON service account with `Basic` authentication, and use the:

- `_json_key` as username
- full Google Cloud Platform service account JSON as password

To avoid JSON-in-JSON wrapping, which can cause problems, encode the JSON service account beforehand.

Google Container Registry does not natively support `_json_key_base64` and a base64 encoded service account.
Google Artifact Registry supports `_json_key_base64` and a base64 encoded service account natively.
If all your dependencies are on the Google Artifact Registry, you can base64 encode and use the service account directly:

1. Download your JSON service account and store it on your machine. Make sure that the service account has `read` (and only `read`) permissions to your artifacts
1. Base64 encode the service account credentials by running `cat service-account.json | base64`
1. Add the encoded service account to your configuration file

   1. If you want to add it to your self-hosted configuration file:

      ```json
      {
        "hostRules": [
          {
            "matchHost": "europe-docker.pkg.dev",
            "username": "_json_key_base64",
            "password": "<base64 service account>"
          }
        ]
      }
      ```

   1. If you want to add it to your repository Renovate configuration file, [encrypt](./configuration-options.md#encrypted) it and then add it:

      ```json
      {
        "hostRules": [
          {
            "matchHost": "europe-docker.pkg.dev",
            "username": "_json_key_base64",
            "encrypted": {
              "password": "<encrypted base64 service account>"
            }
          }
        ]
      }
      ```

If you have dependencies on Google Container Registry (and Artifact Registry) you need to use `_json_key` and a slightly different encoding:

1. Download your JSON service account and store it on your machine. Make sure that the service account has `read` (and only `read`) permissions to your artifacts
1. Open the file and prefix the content with `_json_key:`. The file should look like this:

   ```
   _json_key:{
     "type": "service_account",
     "project_id": "sample-project",
     "private_key_id": "5786ff7e615522b932a2a37b4a6f9645c4316dbd",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDaOkxZut9uDUHV\n...\n/PWs0Wa2z5+IawMD7nO63+b6\n-----END PRIVATE KEY-----\n",
     "client_email": "renovate-lookup@sample-project.iam.gserviceaccount.com",
     "client_id": "115429165445403928973",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/renovate-lookup%40sample-project.iam.gserviceaccount.com"
   }
   ```

1. Base64 encode the prefixed service account credentials by running `cat prefixed-service-account.json | base64`
1. Add the prefixed and encoded service account to your configuration file

   1. If you want to add it to your self-hosted configuration file:

      ```json
      {
        "hostRules": [
          {
            "matchHost": "europe-docker.pkg.dev",
            "authType": "Basic",
            "token": "<base64 prefixed service account>"
          }
        ]
      }
      ```

   1. If you want to add it to your repository Renovate configuration file, [encrypt](./configuration-options.md#encrypted) it and then add it:

      ```json
      {
        "hostRules": [
          {
            "matchHost": "europe-docker.pkg.dev",
            "authType": "Basic",
            "encrypted": {
              "token": "<encrypted base64 prefixed service account>"
            }
          }
        ]
      }
      ```

##### Using short-lived access token / Gitlab CI / Google Cloud

For this example, assume that you want to:

- Run the GitLab CI in the Google Cloud
- Store your Docker images in the Google Container Registry (GCR)

###### Accessing the Google Container Registry

Accessing the GCR uses Bearer token based authentication.

First, install the Google Cloud SDK.
Then get the token by running: `gcloud auth print-access-token`.

###### Short-lived GCR Bearer tokens

The GCR Bearer token expires after 60 minutes.
This means you can _not_ re-use the token in a later build.

Instead, _before_ Renovate starts in the GCR context, you must:

1. Fetch the Google access token
1. Inject the token into the `hostRules` configuration

The following text explains one way to fetch the token, and inject it into Renovate.

###### Basic approach

The basic approach is:

1. Create a custom image: fetch the GCR token, and inject the token into Renovate's `config.js` file
1. Then run Renovate as one of the stages of your project

###### Independent runs

To make the run independent of any user, use a [`Project Access Token`](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html).
Give the Project Access Token these scopes:

- `api`
- `read_api`
- `write_repository`

Then use the Project Access Token as the `RENOVATE_TOKEN` variable for GitLab CI.
For more (`gitlab-ci.yml`) configuration examples, see the [`renovate-runner` repository on GitLab](https://gitlab.com/renovate-bot/renovate-runner).

###### Create a custom image

To access the token, you need a custom Renovate Docker image.
Make sure to install the Google Cloud SDK into the custom image, as you need the `gcloud auth print-access-token` command later.

For example:

```Dockerfile
FROM renovate/renovate:39.164.1
# Include the "Docker tip" which you can find here https://cloud.google.com/sdk/docs/install
# under "Installation" for "Debian/Ubuntu"
RUN ...
```

###### Accessing the Google Container Registry (GCR)

Renovate needs the current Google Access Token to access the Google Container Registry (GCR).
Here's an example of how to set that up:

```js
hostRules: [
  {
    matchHost: 'eu.gcr.io',
    token: 'MyReallySecretTokenThatExpiresAfter60Minutes',
  },
];
```

One way to give Renovate the short-lived Google Access Token is to:

1. Write a script that generates a `config.js` file, with the token, in your `gitlab-ci.yml` file
1. Run the `config.js` creation script just before you start Renovate

For example:

```yaml
script:
  - 'echo "module.exports = { hostRules: [ { matchHost: ''eu.gcr.io'', token: ''"$(gcloud auth print-access-token)"'' } ] };" > config.js'
  - renovate $RENOVATE_EXTRA_FLAGS
```
