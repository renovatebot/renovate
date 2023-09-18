Renovate's Node.js versioning is a wrapper around npm versioning.
But Renovate removes any `v` prefixes from semantic versions when replacing.

Its primary purpose is to add Node.js LTS awareness, e.g.:

- Odd releases are unstable
- Even releases do not reach stability (LTS) immediately
