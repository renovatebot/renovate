The Debian datasource enables Renovate to update packages from Debian repositories.
It is ideal for projects that depend on Debian-based systems or distributions.
You will need to combine Debian datasource with [regex managers](../../manager/regex/index.md) to update dependencies.

**Registry URL**
To use a Debian repository with the datasource, you need a properly formatted URL with specific query parameters as `registryUrl`:

- `components`: Comma-separated list of repository components (e.g., `main,contrib,non-free`).
- `binaryArch`: Architecture of the binary packages (e.g., `amd64`,`all`).
- Either `suite` or `release`:
  - `suite`: A rolling release alias like `stable`.
  - `release`: A fixed release name such as `bullseye` or `buster`.

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
        "#\\s*renovate:\\s*?depName=(?<depName>.*?)?\\sENV .*?_VERSION=\"(?<currentValue>.*)\"\\s"
      ],
      "registryUrlTemplate": "https://deb.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64",
      "datasourceTemplate": "deb"
    }
  ]
}
```

Then you would put comments in your Dockerfile, to tell Renovate where to find the updates:

```dockerfile
FROM debian:bullseye

# renovate: depName=gcc-11
ENV GCC_VERSION="11.2.0-19"

RUN apt-get update && \
    apt-get install -y \
    gcc-11="${GCC_VERSION}" && \
    apt-get clean
```

When the apt package for `gcc` is updated, Renovate updates the environment variable.

```json title="Overwrite deb registryUrl via packageRule"
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

This datasource can also be used with Artifactory.
The supported repository types are:
- virtual
- local
- remote

If you are using Artifactory, you can use the `deb` datasource with following `registryUrl` format:

```
https://<host>:<port>/artifactory/<repository-slug>?suite=<suite>&components=<components>&binaryArch=<binaryArch>
https://artifactory.example.com:443/artifactory/debian/?release=bookworm&components=main,contrib,non-free&binaryArch=amd64
```

Further, you have to set up a host rule to authenticate against Artifactory.
Use the "Set Me Up" feature in Artifactory to generate a password for Renovate.
Then add the following configuration:

```json title="Artifactory host rule configuration with username and password"
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
