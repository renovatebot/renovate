Dummy versioning treats any non-empty string as a valid version.
It only guarantees strict string equality — a version matches only itself and is never considered greater than another.

This is useful for dependencies like GitHub Actions where each tag represents a specific feature, and only the digest should be updated while keeping the tag unchanged.
