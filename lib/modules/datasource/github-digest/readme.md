This datasource fetches both tags and branches from GitHub repositories, prioritizing tags over branches when names conflict.

It's designed for GitHub Actions that reference non-semver refs like `v4` (which could be a tag or branch) or branch names like `main`. It uses exact versioning, meaning no version ordering is performed - only digest pinning updates are supported.

The `github-actions` manager automatically routes to this datasource when the action reference doesn't look like a full semver version (e.g., `v1.2.3`).

**Routing logic:**

- `actions/checkout@v4.2.0` → `github-tags` (full semver, version updates)
- `actions/checkout@v4` → `github-digest` (major-only, digest updates)
- `some-action@main` → `github-digest` (branch name, digest updates)
