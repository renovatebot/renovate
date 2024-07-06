The Debian datasource enables Renovate to update packages from Debian repositories. It is ideal for projects that depend on Debian-based systems or distributions. You will need to combine Debian datasource with [regex managers](../../manager/regex/index.md) to update dependencies.

**Registry URL**
To use a Debian repository with the datasource, you need a properly formatted URL with specific query parameters:

- `components`: Comma-separated list of repository components (e.g., `main,contrib,non-free`).
- `binaryArch`: Architecture of the binary packages (e.g., `amd64`,`all`).
- Either `suite` or `release`:
  - `suite`: A rolling release alias like `stable`.
  - `release`: A fixed release name such as `bullseye` or `buster`.

**Example**:

```
https://ftp.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64
```

This URL points to the `stable` suite of the Debian repository for `amd64` architecture, including `main`, `contrib`, and `non-free` components.

**Usage Example**

Say you're using apt packages in a Dockerfile and want to update them.
With the debian datasource you can "pin" each dependency, and get automatic updates.

First you would set a custom manager in your `renovate.json` file for `Dockerfile`:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "#\\s*renovate:\\s* depName=(?<depName>.*?)( versioning=(?<versioning>loose))?\\sENV .*?_VERSION=\"(?<currentValue>.*)\"\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}loose{{/if}}"
    }
  ],
  "packageRules": [
    {
      "datasources": ["deb"],
      "registryUrls": [
        "https://ftp.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64"
      ]
    }
  ]
}
```

Then you would put comments in your Dockerfile, to tell Renovate where to find the updates:

```dockerfile
FROM debian:bullseye

# renovate: depName=gcc versioning=loose
ENV GCC_VERSION="10.2.1-6"

RUN apt-get update && \
    apt-get install -y \
    gcc="${GCC_VERSION}" && \
    apt-get clean
```

When the apt package for `gcc` is updated, Renovate updates the environment variable.

<!-- prettier-ignore -->
!!! tip
    We recommend you try `loose` versioning for distribution packages first.
    This is because the version number usually doesn't match Renovate's default `semver-coerced` specification.
