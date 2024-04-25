Renovate's Node.js versioning is a wrapper around npm versioning.
But Renovate removes any `v` prefixes from semantic versions when replacing.

Its primary purpose is to add Node.js LTS awareness, e.g.:

- Odd releases are unstable
- Even releases do not reach stability (LTS) immediately

You can _not_ use `node` versioning to replace `docker` versioning if you are using node tags with suffixes like `-alpine`.
This is because npm versioning treats these suffixes as implying pre-releases/instability.
