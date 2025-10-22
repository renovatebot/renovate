Renovate's Partial Semantic Versioning supports partial version numbers that resolve to the latest matching full version, following [Semantic Versioning 2.0](https://semver.org) conventions.

This versioning is used by [GitLab CI/CD Components](https://docs.gitlab.com/ci/components/#partial-semantic-versions) to allow specifying incomplete version numbers that automatically resolve to the latest version matching that pattern. This enables you to receive updates within a specific version range without specifying the full version.

**Version Resolution:**

- `1.2` → Selects the latest `1.2.*` version
- `1` → Selects the latest `1.*.*` version
- `~latest` → Selects the latest released version

**Example:**

Given available versions: `1.0.0`, `1.1.0`, `1.1.1`, `1.2.0`, `2.0.0`, `2.0.1`, `2.1.0`:

- `1` resolves to `1.2.0`
- `1.1` resolves to `1.1.1`
- `~latest` resolves to `2.1.0`

**Pre-release Handling:**

Pre-release versions (e.g., `1.0.1-rc`, `2.0.0-beta`) are not selected by partial versions. You must specify the full version to match a pre-release.
