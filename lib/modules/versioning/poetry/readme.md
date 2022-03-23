Poetry versioning is a little like a mix of PEP440 and SemVer.

Currently Renovate's implementation is based off npm versioning.
This works by parsing versions using the same patterns and similar normalization rules as Poetry, passing them to the npm versioning implementation, and then reversing the normalizations.
This allows Renovate to meaningfully compare the SemVer-style versions allowed in `pyproject.toml` to the PEP440 representations used on PyPI.
These are equivalent for major.minor.patch releases, but different for pre-, post-, and dev releases.
