Renovate's Lambda Node.js versioning is a wrapper around the existing Node.js Versioning module with the only difference being
that it lists versions not currently supported by AWS as being unstable. This is intended to be a drop-in replacement
for dependencies that follow the `node` versioning schedule if you need to keep them in line with Lambda Runtime
releases.

Its primary purpose is to add Node Runtime support awareness, e.g.:

- Old Runtimes that cannot be updated will be marked as unstable
- Node.js LTS releases that do not have Runtimes released for them will be marked as unstable

You can _not_ use `lambda-node` versioning to replace `docker` versioning if you are using node tags with suffixes like
`-alpine`. This is because npm versioning treats these suffixes as implying pre-releases/instability.
