# Self-Hosting Examples

## Installing Renovate OSS CLI

### npmjs

```sh
npm install -g renovate
```

Renovate does not embed `npm`, `pnpm` and `yarn` as its own dependencies.
If you want to use these package managers to update your lockfiles, you must ensure that the correct versions are installed globally.

```sh
npm install -g yarn pnpm
```

The same goes for any other third-party binary tool like `gradle` or `poetry` - you need to make sure it is installed and the correct version before running Renovate.

### Docker

Renovate is available for Docker via an automated build at [`renovate/renovate` on Docker Hub](https://hub.docker.com/r/renovate/renovate/).
It builds `latest` based on the `main` branch and all SemVer tags are published too.

```sh title="Example of valid tags"
docker run --rm renovate/renovate
docker run --rm renovate/renovate:35
docker run --rm renovate/renovate:35.14
docker run --rm renovate/renovate:35.14.4
```

<!-- prettier-ignore -->
!!! warning
    Do not use the example tags listed above, as they will be out-of-date.
    Go to [the `renovate/renovate` tags on DockerHub](https://hub.docker.com/r/renovate/renovate/tags) to grab the latest tagged release from Renovate.

If you want to configure Renovate using a `config.js` file then map it to `/usr/src/app/config.js` using Docker volumes.
For example:

```sh
docker run --rm -v "/path/to/your/config.js:/usr/src/app/config.js" renovate/renovate
```

### Kubernetes

Renovate's official Docker image is compatible with Kubernetes.
The following is an example manifest of running Renovate against a GitHub Enterprise server.

```yaml title="Kubernetes manifest"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: renovate
spec:
  schedule: '@hourly'
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: renovate
              # Update this to the latest available and then enable Renovate on
              # the manifest
              image: renovate/renovate:35.14.4
              args:
                - user/repo
              # Environment Variables
              env:
                - name: LOG_LEVEL
                  value: debug
              envFrom:
                - secretRef:
                    name: renovate-env
          restartPolicy: Never
```

And the `secret.yaml` that goes with it:

```yaml title="secret.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: renovate-env
type: Opaque
stringData:
  GITHUB_COM_TOKEN: 'any-personal-user-token-for-github-com-for-fetching-changelogs'
  # You can set RENOVATE_AUTODISCOVER to true to run Renovate on all repos you have push access to
  RENOVATE_AUTODISCOVER: 'false'
  RENOVATE_ENDPOINT: 'https://github.company.com/api/v3'
  RENOVATE_GIT_AUTHOR: 'Renovate Bot <bot@renovateapp.com>'
  RENOVATE_PLATFORM: 'github'
  RENOVATE_TOKEN: 'your-github-enterprise-renovate-user-token'
```

A `config.json` file can be added to the manifest using a `ConfigMap` as shown in the following example (using a "dry run" in github.com):

```yaml title="Adding a config.json file to the manifest with configMap"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: renovate-config
data:
  config.json: |-
    {
      "repositories": ["orgname/repo","username/repo"],
      "dryRun" : "true"
    }

---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: renovate-bot
spec:
  schedule: '@hourly'
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - image: renovate/renovate:35.14.4
              name: renovate-bot
              env: # For illustration purposes, please use secrets.
                - name: RENOVATE_PLATFORM
                  value: 'github'
                - name: RENOVATE_TOKEN
                  value: 'some-token'
                - name: RENOVATE_AUTODISCOVER
                  value: 'false'
                - name: RENOVATE_BASE_DIR
                  value: '/tmp/renovate/'
                - name: RENOVATE_CONFIG_FILE
                  value: '/opt/renovate/config.json'
                - name: LOG_LEVEL
                  value: debug
              volumeMounts:
                - name: config-volume
                  mountPath: /opt/renovate/
                - name: work-volume
                  mountPath: /tmp/renovate/
          restartPolicy: Never
          volumes:
            - name: config-volume
              configMap:
                name: renovate-config
            - name: work-volume
              emptyDir: {}
```

### CircleCI

<!-- prettier-ignore -->
!!! warning
    The CircleCI configuration examples are for version `2` of `daniel-shuy/renovate`, which is outdated.
    Do you know how to get `daniel-shuy/renovate` version `3` working?
    Then please open a pull request to update the docs and close [Renovate issue #13428](https://github.com/renovatebot/renovate/issues/13428).

If you are using CircleCI, you can use the third-party [daniel-shuy/renovate](https://circleci.com/developer/orbs/orb/daniel-shuy/renovate) orb to run a self-hosted instance of Renovate on CircleCI.

By default, the orb looks for the self-hosted configuration file in the project root, but you can specify another path to the configuration file with the `config_file_path` parameter.

Secrets should be configured using environment variables (e.g. `RENOVATE_TOKEN`, `GITHUB_COM_TOKEN`).

[Configure environment variables in CircleCI Project Settings](https://circleci.com/docs/2.0/env-vars/#setting-an-environment-variable-in-a-project).
To share environment variables across projects, use [CircleCI Contexts](https://circleci.com/docs/2.0/contexts/).

The following example runs Renovate hourly, and looks for the self-hosted configuration file at `renovate-config.js`:

```yml
version: '2.1'
orbs:
  renovate: daniel-shuy/renovate@2.2.0
workflows:
  renovate:
    jobs:
      - renovate/self-hosted:
          config_file_path: renovate-config.js
    nightly:
      triggers:
        - schedule:
            cron: 0 * * * *
            filters:
              branches:
                only:
                  - main
```

#### Renovate config file validation when using CircleCI

How to validate your config as part of your workflow:

```yml
version: '2.1'
orbs:
  renovate: daniel-shuy/renovate@2.2.0
workflows:
  lint:
    jobs:
      - renovate/validate-config
```

### GitLab CI/CD pipeline

For GitLab pipelines we recommend you use the [`renovate-runner` project on GitLab](https://gitlab.com/renovate-bot/renovate-runner).
We created some pipeline templates to help you run Renovate on pipeline schedules.
You can also find the configuration steps there.

For self-hosted GitLab clone/import the [`renovate-runner` project on GitLab](https://gitlab.com/renovate-bot/renovate-runner) project to your instance.

## File/directory usage

By default, Renovate stores all files in the `renovate/` subdirectory of the operating system's temporary directory, e.g. `/tmp/renovate/`.

Repository data is copied or cloned into unique subdirectories under `repos/`, e.g. `/tmp/renovate/repos/github/owner1/repo-a/`.

Renovate's cache, and the caches(s) for npm, Yarn, Composer, and so on, are stored in `/tmp/renovate/cache`.

### Overriding the default directory

If you don't want to use the default `tmp/renovate` directory you can:

- Set a value for `baseDir` in `config.js`
- Use an environment variable `RENOVATE_BASE_DIR`
- Use the CLI to pass a base directory: `--base-dir=`

### Overriding the default cache directory

If you want to override the cache directory then set your own value for `cacheDir`.

## Usage

The following example uses the Renovate CLI tool, which you can install by running `npm i -g renovate`.

If running your own Renovate bot then you will need a user account that Renovate will run as.
We recommend you create and use a dedicated account for the bot, e.g. name it `renovate-bot` if on your own instance.
Create and save a PAT for this account.

Create a Renovate config file, for example:

```js
module.exports = {
  endpoint: 'https://self-hosted.gitlab/api/v4/',
  token: '**gitlab_token**',
  platform: 'gitlab',
  onboardingConfig: {
    extends: ['config:recommended'],
  },
  repositories: ['username/repo', 'orgname/repo'],
};
```

Here change the `logFile` and `repositories` to something appropriate.
Also replace `gitlab-token` value with the one created during the previous step.

If you're running against GitHub Enterprise Server, then change the `gitlab` values in the example to the equivalent GitHub ones.

You can save this file as anything you want and then use the `RENOVATE_CONFIG_FILE` environment variable to tell Renovate where to find it.

Most people use `cron` to schedule when Renovate runs, usually on an hourly schedule.

```sh title="Example bash script that you can point cron to"
#!/bin/bash

export PATH="/home/user/.yarn/bin:/usr/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export RENOVATE_CONFIG_FILE="/home/user/renovate-config.js"
export RENOVATE_TOKEN="**some-token**" # GitHub, GitLab, Azure DevOps
export GITHUB_COM_TOKEN="**github-token**" # Delete this if using github.com

# Renovate
renovate
```

Save the script file, and run the script manually.
Only add the script to `cron` after you checked it works.

<!-- prettier-ignore -->
!!! note
    The GitHub.com token as an environment variable is needed to fetch changelogs that are usually hosted on github.com.
    You don't need to add it if you are already running the bot against github.com, but you do need to add it if you're using GitHub Enterprise Server, GitLab, Azure DevOps, or Bitbucket.

## Kubernetes for GitLab, using Git over SSH

This section describes how to use a Git binary with SSH for GitLab, to avoid API shortcomings.

You need to first create a SSH key, then add the public part to GitLab (see this [guide](https://docs.gitlab.com/ee/ssh/)).

Then, you need to create the secret to add the SSH key, and the following config to your container:

```
host gitlab.com
  HostName gitlab.com
  StrictHostKeyChecking no
  IdentityFile ~/.ssh/id_rsa
  User git
```

To easily create the secret, you can do the following (see [docs](https://kubernetes.io/docs/concepts/configuration/secret/#use-case-pod-with-ssh-keys)).

```sh
kubectl create secret generic ssh-key-secret --from-file=config=/path/to/config --from-file=id_rsa=/path/to/.ssh/id_rsa --from-file=id_rsa.pub=/path/to/.ssh/id_rsa.pub
```

It creates something like this:

```yml
apiVersion: v1
data:
  config: aG9zdCBnaXRsYWIuY29tCiAgSG9zdE5hbWUgZ2l0bGFiLmNvbQogIFN0cmljdEhvc3RLZXlDaGVja2luZyBubwogIElkZW50aXR5RmlsZSB+Ly5zc2gvaWRfcnNhCiAgVXNlciBnaXQ=
  id_rsa: <base64String>
  id_rsa.pub: <base64String>
kind: Secret
metadata:
  name: ssh-key-secret
  namespace: <namespace>
```

Then you need to add a Git author, and configure the mount volumes.
The final configuration should look something like this:

```yml
---
apiVersion: v1
kind: Namespace
metadata:
  name: <namespace, for example renovate>

---
apiVersion: v1
kind: Secret
metadata:
  name: renovate-env
  namespace: <namespace>
type: Opaque
stringData:
  GITHUB_COM_TOKEN: 'any-personal-user-token-for-github-com-for-fetching-changelogs'
  RENOVATE_AUTODISCOVER: 'false'
  RENOVATE_ENDPOINT: 'https://github.company.com/api/v3'
  RENOVATE_GIT_AUTHOR: 'Renovate Bot <bot@renovateapp.com>'
  RENOVATE_PLATFORM: 'github'
  RENOVATE_TOKEN: 'your-github-enterprise-renovate-user-token'
---
apiVersion: v1
data:
  config: aG9zdCBnaXRsYWIuY29tCiAgSG9zdE5hbWUgZ2l0bGFiLmNvbQogIFN0cmljdEhvc3RLZXlDaGVja2luZyBubwogIElkZW50aXR5RmlsZSB+Ly5zc2gvaWRfcnNhCiAgVXNlciBnaXQ=
  id_rsa: <base64String>
  id_rsa.pub: <base64String>
kind: Secret
metadata:
  name: ssh-key-secret
  namespace: <namespace>
---
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: renovate
  namespace: <namespace>
spec:
  schedule: '@hourly'
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          volumes:
            - name: ssh-key-volume
              secret:
                secretName: ssh-key-secret
          containers:
            - name: renovate
              # Update this to the latest available and then enable Renovate on the manifest
              image: renovate/renovate:35.14.4
              volumeMounts:
                - name: ssh-key-volume
                  readOnly: true
                  mountPath: '/home/ubuntu/.ssh'
              args:
                - <repository>
              # Environment Variables
              envFrom:
                - secretRef:
                    name: renovate-env
          restartPolicy: Never
```

## Logging

If you're ingesting/parsing logs into another system then we recommend you set `LOG_LEVEL=debug` and `LOG_FORMAT=json` in your environment variables.
Debug logging is usually needed for any debugging, while JSON format will mean that the output is parseable.

### About the log level numbers

When you use `LOG_LEVEL=debug` and `LOG_FORMAT=json`, Renovate uses numbers in the `level` field.

The logging level output is controlled by the Bunyan logging library.

| Level | Meaning |
| ----: | ------- |
|    10 | trace   |
|    20 | debug   |
|    30 | info    |
|    40 | warn    |
|    50 | error   |
|    60 | fatal   |

## Self-signed TLS/SSL certificates

Renovate and invoked helper programs (like Git, or npm) use a secure TLS connection (e.g. HTTPS) to connect to remote source code and dependency hosts.
If the remote hosts uses self-signed certificates or certificate authorities then Renovate must be told to trust them.

### Renovate Node.js app

For the main Renovate Node.js application set the environment variable [`NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/self-signed-certificate.crt`](https://nodejs.org/api/cli.html#node_extra_ca_certsfile).
The Renovate application now trusts the `self-signed-certificate.crt` file.
This means Renovate can safely connect to systems using that certificate or certificates signed by this certificate authority.

### Helper programs like Git or npm

Helper programs like Git and npm use the system trust store.
For those programs to trust a self-signed certificate you must add it to the systems trust store.
On Ubuntu/Debian and many Linux-based systems, this can be done by copying the self-signed certificate (e.g. `self-signed-certificate.crt`) to `/usr/local/share/ca-certificates/` and running [`update-ca-certificates`](https://manpages.ubuntu.com/manpages/xenial/man8/update-ca-certificates.8.html) to update the system trust store afterwards.

### Renovate Docker image

If you're using the official [Renovate Docker image](#docker) then we recommend you add the self-signed certificate and build your own modified Docker image.

```dockerfile title="Example of a Dockerfile that uses a self-signed certificate"
FROM renovate/renovate

# Changes to the certificate authority require root permissions
USER root

# Copy and install the self signed certificate
COPY self-signed-certificate.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates

# Change back to the Ubuntu user
USER 1000

# Some tools come with their own certificate authority stores and thus need to trust the self-signed certificate or the entire OS store explicitly.
# This list is _not_ comprehensive and other tools may require further configuration.
#
# Node
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/self-signed-certificate.crt
# Python
RUN pip config set global.cert /etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
# OpenSSL
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
```
