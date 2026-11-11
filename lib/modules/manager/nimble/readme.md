Renovate supports updating dependencies declared in [Nimble](https://github.com/nim-lang/nimble) package manifests (`*.nimble`).

### File Matching

By default, Renovate scans for files matching `/(^|\/)[^/]+\.nimble$/`.

### Supported Dependencies

Nimble manifests declare dependencies via `requires`:

```nim
requires "nim >= 1.6.0"
requires "chronos >= 3.0.0"
requires "https://github.com/status-im/nim-stew#head"
requires "cligen >= 1.5.0", "yaml >= 0.4.0"
```

Renovate extracts:

- Standard Nimble dependencies with SemVer constraint ranges (`>=`, `<=`, `==`, `!=`, `^=`, `~=`, `>`, `<`, `&`)
- Direct Git URL dependencies (`https://...`, `http://...`, `git@...`)
- VCS reference pins (`#head`, `#branch`, `#commit`)
- Feature flag dependencies (`pkg[ssl] >= 1.0.0`)
- Multi-line continuation declarations
- Compiler dependencies (`requires "nim >= 2.0.0"`)

### Package Name & URL Resolution Hierarchy

Because `.nimble` files typically specify bare package names (such as `"chronos"`), Renovate uses a multi-tier resolution pipeline to find canonical Git repository URLs:

1. **Companion Lockfiles (Tier 1)**: If a sibling `nimble.lock` or `atlas.lock` exists in the same directory, Renovate extracts the package's Git repository URL directly from the lockfile.
2. **Official Nim Package Registry (Tier 2)**: Renovate queries the official Nim package registry (`https://raw.githubusercontent.com/nim-lang/packages/master/packages.json`) and caches results in `packageCache` for 24 hours under the `datasource-nimble-packages` namespace. Package aliases are resolved up to 3 hops with circular redirect protection.
3. **Graceful Fallback (Tier 3)**: If the registry is unreachable or the package is not found, `packageName` remains undefined, preventing extraction failures while allowing other dependencies to proceed.

### Lockfile Maintenance

Renovate automatically updates sibling lockfiles when present:

- `nimble.lock` (updating package version and `vcsRevision` commit digests)
- `atlas.lock` (updating package version and `commit` digests)
