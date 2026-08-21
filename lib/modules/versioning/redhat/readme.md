Red Hat versioning is used with container images that are maintained by Red Hat.

Red Hat version definitions follow this pattern:

- the version of the main component, where major is required, but minor and patch are optional
- optionally a '.GA"
- optionally a hyphen followed by release information
- the version of Red Hat's release as an integer, optionally followed by a timestamp like: `1645808164`
- optionally a "v"-prefix

Examples of valid Red Hat versions:

- `1`
- `8.5`
- `7.9-628`
- `v0.4.0-383`
- `9.0.0-19.1655192132`
- `1.0.0.GA-20.1770236070`

Ranges are not supported by this versioning.
