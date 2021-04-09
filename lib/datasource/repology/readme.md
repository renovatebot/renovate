[Repology](https://repology.org/) supports looking up package versions from a wide variety of package repositories and can be used in combination with [regex managers](https://docs.renovatebot.com/modules/manager/regex/) to keep dependencies up-to-date which are not specifically supported by Renovate.

To specify which specific repository should be queried when looking up a package, the `lookupName` has to contain the repository identifier and the package name itself, separated by a slash. As an example, `alpine_3_12/gcc` would look for a binary or source package called `gcc` within the `alpine_3_12` repository.

A [list of all supported repositories](https://repology.org/repositories/statistics) can be found on the Repology homepage. To determine the correct identifier, click on a repository of your choice and make note of the identifier in the URL: `https://repology.org/repository/<identifier>`

As an example, the `Alpine Linux 3.12` repository points to `https://repology.org/repository/alpine_3_12` and therefor has the repository identifier `alpine_3_12`.

**Usage Example**

A real world example for this specific datasource would be maintaining system packages within a Dockerfile, as this allows to specifically pin each dependency without having to manually keep the versions up-to-date. This can be achieved by configuring a generic regex manager in `renovate.json` for files named `Dockerfile`:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "#\\s*renovate:\\s*datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ]
}
```

Now you may use regular comments in your Dockerfile to automatically update dependencies, which could look like this:

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

It is often wise to use the `loose` versioning for distribution packages as the version number usually does not strictly match the `semver` specification which is used by default. Now whenever the OS package for `gcc` of `Alpine Linux 3.12` is being updated, Renovate will automatically adjust the value of the environment variable to the newest version.
