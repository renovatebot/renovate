Renovate uses the Debian datasource to update packages from Debian repositories.
The `debian` datasource is meant for projects that:

- depend on Debian-based systems, or
- depend on Debian-based distributions, like Ubuntu

By default, Renovate does not detect Debian dependencies.
For Renovate to update dependencies, you must combine the Debian datasource with [regex managers](../../manager/regex/index.md).

## Set URL when using a Debian repository

To use a Debian repository with the datasource, you must set a properly formatted URL with specific query parameters as `registryUrl`:

- `components`: Comma-separated list of repository components (e.g., `main,contrib,non-free`).
- `binaryArch`: Architecture of the binary packages (e.g., `amd64`,`all`).
- `suite`:
  - A rolling release alias like `stable`.
  - A fixed release name such as `bullseye` or `buster`.

<!-- prettier-ignore -->
!!! note
    These parameters are used to give Renovate context and are not directly used to call the repository.
    Therefore, the `registryUrl` has not to be a valid URL for a repository.

**Example**:

```
https://deb.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64
```

This URL points to the `stable` suite of the Debian repository for `amd64` architecture, including `main`, `contrib`, and `non-free` components.

## Usage Example

Say you're using apt packages in a Dockerfile and want to update them.
With the debian datasource you can "pin" each dependency, and get automatic updates.

First you would set a custom manager in your `renovate.json` file for `Dockerfile`:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "#\\s*renovate:\\s*?(suite=(?<suite>.*?))?\\s*depName=(?<depName>.*?)?\\sENV .*?_VERSION=\"(?<currentValue>.*)\""
      ],
      "registryUrlTemplate": "https://deb.debian.org/debian?suite={{#if suite }}{{suite}}{{else}}stable{{/if}}&components=main,contrib,non-free&binaryArch=amd64",
      "datasourceTemplate": "deb"
    }
  ]
}
```

Then you would put comments in your Dockerfile, to tell Renovate where to find the updates:

```dockerfile
FROM debian:bullseye

# renovate: suite=bullseye depName=gcc-11
ENV GCC_VERSION="11.2.0-19"

RUN apt-get update && \
    apt-get install -y \
    gcc-11="${GCC_VERSION}" && \
    apt-get clean
```

When the apt package for `gcc` is updated, Renovate updates the environment variable.

```json title="Override deb registryUrl with a packageRules entry"
{
  "packageRules": [
    {
      "matchDatasources": ["deb"],
      "matchPackageNames": ["gcc-11"],
      "registryUrls": [
        "https://deb.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64"
      ]
    }
  ]
}
```

## Artifactory

The Debian datasource can be used with Artifactory.

### Supported repository types

The `debian` datasource supports these repository types:

- virtual
- local
- remote

### Set a `registryUrl`

To use Artifactory, first configure the `deb` datasource by setting the `registryUrl`.

```title="Example of valid registryUrl format"
https://<host>:<port>/artifactory/<repository-slug>?suite=<suite>&components=<components>&binaryArch=<binaryArch>
https://artifactory.example.com:443/artifactory/debian?suite=bookworm&components=main,contrib,non-free&binaryArch=amd64
```

### Authenticating to Artifactory

If Artifactory asks for authentication, you must set up a host rule.
First, generate a password for Renovate with Artifactory's "Set Me Up" feature.
Then, add the following configuration:

```json title="Example Artifactory host rule configuration, with username and password"
{
  "hostRules": [
    {
      "hostType": "deb",
      "matchHost": "https://artifactory.example.com:443/artifactory/debian",
      "username": "myuser",
      "password": "< the generated password >"
    }
  ]
}
```
