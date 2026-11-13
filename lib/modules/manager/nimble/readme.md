Renovate supports updating dependencies declared in [Nimble](https://github.com/nim-lang/nimble) package manifests (`*.nimble`), as well as maintaining companion `nimble.lock` and [Atlas](https://github.com/nim-lang/atlas) `atlas.lock` lockfiles.

### File Matching

By default, Renovate scans for files matching `/(^|\/)[^/]+\.nimble$/`.

### Supported Dependencies

Nimble manifests declare dependencies via `requires` or `taskRequires`:

```nim
requires "nim >= 1.6.0"
requires "chronos >= 3.0.0"
requires "typestates >= 0.14.0 & < 0.15.0"
requires "https://github.com/status-im/nim-stew#head"
requires "github:nim-lang/cmark >= 0.10.0"
requires "cligen >= 1.5.0", "yaml ^= 0.4.0"
requires("jester >= 0.5.0")
taskRequires "test", "testament >= 0.1.0"
taskRequires(bench, "criterion >= 0.2.0")
```

Renovate extracts:

- Standard Nimble dependencies with constraint ranges (`>=`, `<=`, `==`, `^=`, `~=`, `>`, `<`, `&`) evaluated via [`nimble` versioning](../../versioning/nimble/index.md)
- Bare version requirements (`requires "jester 0.5.0"`)
- Direct Git URL dependencies (`https://...`, `http://...`, `git@...`)
- Forge aliases (`github:owner/repo`, `gh:owner/repo`, `gitlab:owner/repo`, `gl:owner/repo`, `codeberg:owner/repo`, `cb:owner/repo`, `cberg:owner/repo`, `sourcehut:owner/repo`, `srht:owner/repo`, `shart:owner/repo`)
- Feature flag dependencies (`pkg[ssl] >= 1.0.0`)
- Multi-line comma-continued and parenthesized declarations
- Compiler dependencies (`requires "nim >= 2.0.0"`, `nimrod`, `compiler`) with `depType: 'compiler'`
- Task-scoped dependencies declared via `taskRequires` with `depType: 'taskRequires'`

Dependencies without version constraints (`requires "pkg"`), VCS reference pins (`#head`, `#branch`, `#commit`), and `file://` URLs are extracted with appropriate `skipReason`s (`unspecified-version`, `not-a-version`, `file-dependency`).

### Package Name & URL Resolution Hierarchy

Because `.nimble` files typically specify bare package names (such as `"chronos"`), Renovate uses a multi-tier resolution pipeline to find canonical Git repository URLs:

1. **Direct URLs and Forge Aliases**: Direct Git/HTTP URLs and forge aliases (`github:...`, `gh:...`, `gitlab:...`, `gl:...`, `codeberg:...`, `cb:...`, `cberg:...`, `sourcehut:...`, `srht:...`, `shart:...`) are resolved directly to repository URLs.
2. **Compiler Mapping**: `nim`, `nimrod`, and `compiler` dependencies are mapped to the official Nim repository (`https://github.com/nim-lang/Nim`).
3. **Tier 1 — Companion Lockfiles (`nimble.lock` & `atlas.lock`)**: If a sibling `nimble.lock` (inspecting `packages` and `tasks.<task>`) or `atlas.lock` (inspecting `items`) exists in the same directory, Renovate extracts the exact locked `url` recorded for the package.
4. **Tier 2 — Official Nim Package Registry**: Bare package names not found in a companion lockfile are resolved by querying the official Nim package registry index (`https://raw.githubusercontent.com/nim-lang/packages/master/packages.json`), cached under the `datasource-nimble-packages` namespace (24-hour TTL). Package aliases are followed up to 3 hops with cycle protection.
5. **Graceful Fallback**: If the registry is unreachable or the package is not found, `packageName` remains undefined, preventing extraction failures while allowing other dependencies to proceed.

### Lock File Maintenance

When a sibling `nimble.lock` or `atlas.lock` is present alongside a `.nimble` manifest, Renovate delegates lockfile regeneration to the native Nimble and Atlas tools provisioned via the `mise` Containerbase tool (`mise exec --yes nim@latest -- nimble lock -y` for `nimble.lock`, and `mise exec --yes nim@latest -- atlas install` followed by `mise exec --yes nim@latest -- atlas pin` for `atlas.lock`).
