Renovate's Node.js versioning is a wrapper around npm versioning.
But Renovate removes any `v` prefixes from semantic versions when replacing.

Its primary purpose is to add Node.js LTS awareness, e.g.:

- Odd releases are unstable
- Even releases do not reach stability (LTS) immediately


Unfortunately there is not currently any way to get `node` versioning to replace `docker` versioning when Docker image tags contain a compatibility suffix such as `-alpine` or `-slim`, because npm versioning treats these suffixes as implying pre-releases.
