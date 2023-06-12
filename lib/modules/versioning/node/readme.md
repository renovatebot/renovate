Renovate's Node.js versioning is a wrapper around npm's versioning.
But Renovate removes any `v` prefixes from exact versions when replacing.

We plan to extend the Node.js versioning to support "stability" awareness.
This is nice to have because Node.js's version stability does not match the SemVer rules.
