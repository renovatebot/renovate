Extracts Docker dependencies from `gitlab-ci.yml` files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

If you use Gitlab Dependency Proxy then you can use these predefined variables as prefixes for your image:

- `CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX`
- `CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX`

If you use predefined GitLab CI variables like `CI_REGISTRY` or `CI_SERVER_FQDN` make sure to configure their value via `registryAliases`:

```json
{
  "registryAliases": {
    "$CI_REGISTRY": "registry.example.com",
    "$CI_SERVER_FQDN": "gitlab.example.com",
    "$CI_SERVER_HOST": "gitlab.example.com"
  }
}
```

Variables with default values (using the `:-` syntax) are also supported:

```json
{
  "registryAliases": {
    "${CI_REGISTRY:-}": "registry.example.com"
  }
}
```

Both image reference formats work:

- With a slash after the variable: `${CI_REGISTRY:-}/image:1.0`
- Without a slash after the variable: `${CI_REGISTRY:-}image:1.0`

The alias value works with or without a trailing slash.

### Component digest pinning and updating

To pin GitLab CI/CD component references (`include:component`) to immutable commit SHAs while keeping Docker image settings separate, enable `pinDigests` for the `repository` `depType`:

```json
{
  "packageRules": [
    {
      "matchManagers": ["gitlabci"],
      "matchDepTypes": ["repository"],
      "pinDigests": true
    }
  ]
}
```

Renovate pins the component version after `@` to its commit SHA and preserves the original tag or branch name in an inline YAML comment:

```yaml
include:
  - component: $CI_SERVER_FQDN/my-org/my-project/my-component@3df4ab11eba7bda6032a0b82a6bb43b11571feac # 1.0.0
```

Components referencing dynamic ranges such as `@~latest` or partial versions (`@1`, `@1.0`) without a matching Git tag cannot be resolved to a commit SHA directly.
Set `"rangeStrategy": "pin"` in your `packageRules` to pin them to a concrete SemVer release and its commit SHA in a single update.

Components pinned to a bare commit SHA without a tag or branch comment are skipped (`unversioned-reference`).
