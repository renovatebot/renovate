Extracts "includes" dependencies from `gitlab-ci.yml` files.

### Digest pinning and updating

To pin `include:project` references to immutable commit SHAs while tracking a tag or branch, add the `helpers:pinGitLabIncludeDigests` preset to the `extends` array (which covers both `gitlabci-include` and `gitlabci` components):

```json
{
  "extends": ["helpers:pinGitLabIncludeDigests"]
}
```

Or enable `pinDigests` directly for this manager:

```json
{
  "gitlabci-include": {
    "pinDigests": true
  }
}
```

Renovate pins the `ref` to its commit SHA and preserves the original tag or branch name in an inline YAML comment:

```yaml
include:
  - project: 'my-org/dependency-ci-templates'
    ref: '3df4ab11eba7bda6032a0b82a6bb43b11571feac' # v2.0.0
    file: 'scan.yml'
```

Renovate supports both SHA-1 (40 characters) and SHA-256 (64 characters) commit hashes and updates the commit SHA when the tracked tag or branch moves, as well as updating both the SHA and version comment when a newer tag is released.

Includes pinned to a bare commit SHA without a tag or branch comment are skipped (`unversioned-reference`), because Renovate cannot determine which ref the SHA belongs to.
Digest pinning is disabled for inline YAML flow mappings (such as `{ project: ..., ref: ... }`) and block scalars, where an inline trailing comment cannot be safely appended.
