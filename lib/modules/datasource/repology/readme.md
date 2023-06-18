With [Repology](https://repology.org/) you can look up package versions from many package repositories.
You can combine Repology with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to update dependencies which are not supported by Renovate.

The `packageName` field should be constructed using the repository identifier and the actual package name separated by a slash.
For example: `alpine_3_12/gcc` would look for a binary (or source package) called `gcc` within the `alpine_3_12` repository.

A [list of all supported repositories](https://repology.org/repositories/statistics) can be found on the Repology homepage.

To find the correct identifier, select the repository you want and copy the identifier in the URL: `https://repology.org/repository/<identifier>`.
For example, the `Alpine Linux 3.12` repository has this URL: `https://repology.org/repository/alpine_3_12` and has this repository identifier: `alpine_3_12`.

**Usage Example**

Say you're using system packages in a Dockerfile and want to update them with Repology.
With the Repology datasource you can "pin" each dependency, and get automatic updates.

First you would set a generic regex manager in your `renovate.json` file for `Dockerfile`:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "#\\s*renovate:\\s*datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=\"(?<currentValue>.*)\"\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ]
}
```

Then you would put comments in your Dockerfile, to tell Renovate where to find the updates:

```docker
FROM alpine:3.12.0@sha256:a15790640a6690aa1730c38cf0a440e2aa44aaca9b0e8931a9f2b0d7cc90fd65

# renovate: datasource=repology depName=alpine_3_12/gcc versioning=loose
ENV GCC_VERSION="9.3.0-r2"
# renovate: datasource=repology depName=alpine_3_12/musl-dev versioning=loose
ENV MUSL_DEV_VERSION="1.1.24-r8"

RUN apk add --no-cache \
    gcc="${GCC_VERSION}" \
    musl-dev="${MUSL_DEV_VERSION}"
```

When the operating system package for `gcc` of `Alpine Linux 3.12` is updated, Renovate updates the environment variable.

<!-- prettier-ignore -->
!!! tip
    We recommend you try `loose` or `deb` versioning for distribution packages first.
    This is because the version number usually doesn't match Renovate's default `semver-coerced` specification.
